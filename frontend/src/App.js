import { Routes, Route, Navigate } from "react-router-dom";
import { CSSTransition, TransitionGroup } from "react-transition-group";

import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";
import ForgotPassword from "./pages/ForgotPassword/ForgotPassword";
import { AuthProvider } from "./utils/AuthContext";

function App() {
  return (
    <Routes>
      {/* Public routes (không cần AuthProvider) */}
      <Route path="/" element={<Navigate to="/login" />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot_password" element={<ForgotPassword />} />

      {/* Protected routes */}
      <Route
        path="/*"
        element={
          <AuthProvider>
            
          </AuthProvider>
        }
      />
    </Routes>
  );
}

export default App;
