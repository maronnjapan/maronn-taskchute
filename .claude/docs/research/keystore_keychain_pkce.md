# Keystore / Keychain と PKCE 学習リソース

このドキュメントは、スマホネイティブアプリにおける OIDC/OAuth2 PKCE フローの認証情報保持に関する調査結果と参考資料をまとめたもの。
`capacitor-secure-storage-plugin` 導入時の調査（2026-04-05）に基づく。

---

## 読む順の推奨

```
RFC 7636 (PKCEの仕組みを理解)
  ↓
RFC 8252 (ネイティブアプリでの注意点を理解)
  ↓
Android Keystore → EncryptedSharedPreferences (Androidの保存基盤)
iOS Keychain Services (iOSの保存基盤)
  ↓
プラグインREADME (上2つをCapacitorから使う方法)
```

---

## 今回使ったプラグイン

### capacitor-secure-storage-plugin
- **URL**: https://github.com/martinkasa/capacitor-secure-storage-plugin
- **概要**: 今回導入したプラグインのソース・API 仕様。iOS Keychain / Android Keystore を Capacitor から統一 API で扱える。

---

## ネイティブ基盤

### Android Keystore System
- **URL**: https://developer.android.com/training/articles/keystore
- **概要**: Android の暗号鍵コンテナの仕組みと API の公式解説。鍵がプロセス空間に露出しないハードウェア支援の暗号化基盤。

### EncryptedSharedPreferences（Android Jetpack Security）
- **URL**: https://developer.android.com/topic/security/data
- **概要**: Keystore を裏側に使った Key-Value 暗号化ストレージの実装方法。`capacitor-secure-storage-plugin` はこれをバックエンドに使用している。

### iOS Keychain Services
- **URL**: https://developer.apple.com/documentation/security/keychain_services
- **概要**: Apple の Keychain API 公式ドキュメント。Secure Enclave によるハードウェア保護、アクセス制御属性（`kSecAttrAccessible*`）の設定方法など。

---

## OAuth / PKCE の仕様

### RFC 7636 — Proof Key for Code Exchange (PKCE)
- **URL**: https://www.rfc-editor.org/rfc/rfc7636.html
- **概要**: `code_verifier` / `code_challenge` の生成・検証フローを定義した仕様書。Section 4（フロー図）だけ読むと要点を掴める。

### RFC 8252 — OAuth 2.0 for Native Apps
- **URL**: https://www.rfc-editor.org/rfc/rfc8252.html
- **概要**: ネイティブアプリにおける OAuth 2.0 のベストプラクティス仕様。External User Agent（Custom Tabs / ASWebAuthenticationSession）の必須化、リダイレクト URI の扱いなど。Section 8（セキュリティ考慮事項）を重点的に読む。

---

## 調査から得られた主な知見

### `state` / `code_verifier` の保持
| 方法 | 評価 |
|---|---|
| メモリ（変数） | 最も安全・推奨。フロー完了後に消える |
| Keychain / Keystore | 次善。プロセス再起動でも消えない |
| `localStorage` | 非推奨。平文ディスク書き込み |
| `sessionStorage` | 最悪。プロセスkillで揮発かつ暗号化なし |

### アクセストークン・リフレッシュトークンの保持
- **iOS Keychain / Android Keystore 一択**。
- `localStorage` は Root/Jailbreak で即窃取される。

### このプロジェクトの対応
- PKCE state を `localStorage` → `capacitor-secure-storage-plugin` (Keychain/Keystore) に移行済み（`src/client/services/auth0-native.ts`）。
- アクセストークンはサーバーサイドセッション（Cookie）に即交換するため JS 側に残らない設計になっており、長期トークンの保存問題は発生しない。
