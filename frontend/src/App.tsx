import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "@/pages/LoginPage";
import PostLoginPage from "@/pages/PostLoginPage";
import { ProtectedRoute, PublicOnlyRoute } from "@/routes/AuthRouteGuards";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <PostLoginPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
