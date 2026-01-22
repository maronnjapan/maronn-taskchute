# Cloudflare Assets の location ヘッダー問題の解説

## 問題の概要

Cloudflare Workers の新しい Assets 機能を使用した際、SPAルート（`/tasks` など）にアクセスすると `location: /` ヘッダーが自動的に付与され、意図しないリダイレクトが発生する問題が発生しました。

## なぜ `location` ヘッダーが付いているのか

### 1. Cloudflare Assets の正規化動作

Cloudflare Assets は、静的ファイルを効率的に配信するために、内部的に特別な最適化を行っています。

ディレクトリへのアクセスを正規化する機能：

```
/tasks → /tasks/ → /tasks/index.html
```

しかし、`/tasks` というファイルは存在しないため、Assetsは以下のように動作します：

1. `/tasks` へのリクエストを受け取る
2. `/tasks` というファイルは存在しない
3. `/tasks/` というディレクトリを探す → 存在しない
4. **デフォルトの動作**: ルートパス `/` にリダイレクトする `location: /` ヘッダーを付ける

これは一般的な静的ホスティングサービスの動作です（例: GitHub Pages, Netlify など）。

### 2. なぜこの動作が起きるのか

Cloudflare Assets は以下の優先順位でファイルを探します：

```
1. /tasks （ファイルとして）
2. /tasks/ （ディレクトリとして）
3. /tasks/index.html （ディレクトリのインデックス）
4. 見つからない場合 → location: / を返す
```

SPAの場合、`/tasks` は React Router のクライアントサイドルートであり、実際のファイルではありません。そのため、Assets は「存在しないパス」と判断し、フォールバック動作としてルートへのリダイレクトヘッダーを付けます。

## なぜ `location` ヘッダーが問題なのか

### HTTPの仕様上の矛盾

```http
HTTP/2 200
location: /
content-type: text/html; charset=utf-8
```

この状態は矛盾しています：
- **ステータス 200**: 成功、コンテンツを返す
- **location ヘッダー**: 別のURLにリダイレクトせよ

### ブラウザの動作

HTTPの仕様（RFC 7231）では、`location` ヘッダーは主に 3xx リダイレクトレスポンスと共に使用されることを想定しています。

```javascript
// ブラウザの動作（仕様による）
if (response.status >= 300 && response.status < 400 && response.headers.has('location')) {
  // リダイレクト
  window.location = response.headers.get('location');
} else if (response.status === 200 && response.headers.has('location')) {
  // ⚠️ 仕様上は曖昧な状態
  // 一部のブラウザはlocationを無視、一部はリダイレクトする
  // 特にJavaScriptのfetch()では予期しない動作になる可能性がある
}
```

### 実際に起きる問題

1. **ブラウザの直接アクセス**: 
   - `/tasks` にアクセス → `location: /` を検出 → ルートにリダイレクトされる
   - ユーザーは `/tasks` ページを見ることができない

2. **React Router の動作不良**:
   - React Router が `/tasks` を処理する前にリダイレクトが発生
   - クライアントサイドルーティングが機能しない

3. **ブラウザキャッシュの問題**:
   - `location` ヘッダーがキャッシュされる可能性
   - 一度リダイレクトが発生すると、キャッシュクリアまで `/tasks` にアクセスできない

## なぜ `Content-Type` を明示的にセットする必要があるのか

### Assets からのレスポンスの性質

Cloudflare Assets が `/index.html` を返す際のヘッダー：

```http
content-type: text/html
location: /
cache-control: public, max-age=0, must-revalidate
etag: "..."
```

このレスポンスをそのまま使うと：

```javascript
// サーバー側コード
const indexResponse = await c.env.ASSETS.fetch(indexRequest);
return new Response(indexResponse.body, {
  status: 200,
  headers: indexResponse.headers,  // ← location ヘッダーも含まれる
});
```

### 新しいヘッダーオブジェクトを作る理由

単純に `headers.delete('location')` では不十分な場合があるため、確実に制御するために新しい Headers オブジェクトを作成します：

```javascript
// 新しいHeadersオブジェクトを作成（locationを除外）
const newHeaders = new Headers();
for (const [key, value] of indexResponse.headers.entries()) {
  if (key.toLowerCase() !== 'location') {
    newHeaders.set(key, value);
  }
}
newHeaders.set('Content-Type', 'text/html; charset=utf-8');
```

この `Content-Type` の明示的なセットは以下の理由があります：

1. **確実性の担保**: Assets からのレスポンスが `text/html` か `text/html; charset=utf-8` かは環境により異なる可能性がある
2. **意図の明示**: このレスポンスが HTML ドキュメントであることを明確にする
3. **将来の変更への対応**: Assets の動作が変わっても、確実に HTML として返すことを保証

### なぜ単純に `delete()` しないのか

Response の headers は**イミュータブル**（変更不可）な場合があります：

```javascript
const indexResponse = await c.env.ASSETS.fetch(indexRequest);
indexResponse.headers.delete('location');  // ❌ エラーになる可能性がある
```

また、Headers オブジェクトをコピーする際、内部参照が共有される可能性があるため：

```javascript
const headers = new Headers(indexResponse.headers);
headers.delete('location');  // △ 動作するが、元のheadersに影響する可能性がある
```

確実に新しい Headers オブジェクトを作成することで、元のレスポンスに影響を与えずに制御できます。

## 解決策

### 実装コード

```typescript
// 静的アセット配信とSPAフォールバック
app.get('*', async (c) => {
  const url = new URL(c.req.url);
  let pathname = url.pathname;

  // ルートパスまたは拡張子がないパス（SPAルート）は index.html を返す
  if (pathname === '/' || (!pathname.includes('.') && !pathname.startsWith('/api'))) {
    const indexRequest = new Request(new URL('/index.html', url.origin));
    const indexResponse = await c.env.ASSETS.fetch(indexRequest);
    
    // 新しいHeadersオブジェクトを作成（locationを除外）
    const newHeaders = new Headers();
    for (const [key, value] of indexResponse.headers.entries()) {
      if (key.toLowerCase() !== 'location') {
        newHeaders.set(key, value);
      }
    }
    newHeaders.set('Content-Type', 'text/html; charset=utf-8');
    
    return new Response(indexResponse.body, {
      status: 200,
      headers: newHeaders,
    });
  }

  // 静的アセット（JS, CSS, 画像など）を配信
  const assetRequest = new Request(new URL(pathname, url.origin));
  const response = await c.env.ASSETS.fetch(assetRequest);
  
  // 404の場合も index.html を返す（SPA フォールバック）
  if (response.status === 404) {
    const indexRequest = new Request(new URL('/index.html', url.origin));
    const indexResponse = await c.env.ASSETS.fetch(indexRequest);
    
    const newHeaders = new Headers();
    for (const [key, value] of indexResponse.headers.entries()) {
      if (key.toLowerCase() !== 'location') {
        newHeaders.set(key, value);
      }
    }
    newHeaders.set('Content-Type', 'text/html; charset=utf-8');
    
    return new Response(indexResponse.body, {
      status: 200,
      headers: newHeaders,
    });
  }
  
  return response;
});
```

### ポイント

1. **拡張子のないパスを検出**: `!pathname.includes('.')` で SPAルートを判定
2. **location ヘッダーを除外**: 新しい Headers オブジェクトを作成し、location を含めない
3. **Content-Type を明示**: HTML であることを確実にする
4. **404時のフォールバック**: 存在しないパスも index.html を返す

## まとめ

- Cloudflare Assets は存在しないパスに対して `location: /` を自動的に付与する
- この動作は静的サイトには適しているが、SPAには不適切
- `location` ヘッダーがあると、ブラウザが意図しないリダイレクトを行う可能性がある
- 解決策として、location ヘッダーを除外した新しい Response を作成する
- Content-Type を明示的にセットすることで、確実に HTML として返すことを保証する

## 参考リンク

- [RFC 7231 - Location Header](https://tools.ietf.org/html/rfc7231#section-7.1.2)
- [Cloudflare Workers - Assets](https://developers.cloudflare.com/workers/static-assets/)
- [MDN - Response Headers](https://developer.mozilla.org/en-US/docs/Web/API/Response/headers)
