import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { CSSTransition, SwitchTransition } from "react-transition-group";
import { useRef } from "react";

import Login from "./pages/Login/Login";
import Register from "./pages/Register/Register";
import ForgotPassword from "./pages/ForgotPassword/ForgotPassword";
import { AuthProvider } from "./utils/AuthContext";

function App() {
  const location = useLocation();
  const nodeRef = useRef(null); // ref cho container

  return (
    <div>
      <SwitchTransition>
        <CSSTransition
          key={location.pathname}
          nodeRef={nodeRef}
          timeout={300}
          classNames="page"
          unmountOnExit
        >
          <div ref={nodeRef} className="route-section">
            <Routes location={location}>
              <Route path="/" element={<Navigate to="/login" />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot_password" element={<ForgotPassword />} />
              <Route
                path="/*"
                element={
                  <AuthProvider>
                    <div>Protected content</div>
                  </AuthProvider>
                }
              />
            </Routes>
          </div>
        </CSSTransition>
      </SwitchTransition>
    </div>
  );
}

export default App;



