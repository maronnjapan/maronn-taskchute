import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TaskListPage } from './pages/TaskListPage';
import { SharedWorkspacePage } from './pages/SharedWorkspacePage';
import { Header } from './components/features/Header';
import { DeepLinkHandler } from './components/features/DeepLinkHandler';

export function App() {
  return (
    <BrowserRouter>
      <DeepLinkHandler />
      <div className="min-h-screen bg-gray-100">
        <Header />
        <main>
          <Routes>
            <Route path="/" element={<TaskListPage />} />
            <Route path="/tasks" element={<TaskListPage />} />
            <Route path="/s/:shareToken" element={<SharedWorkspacePage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
