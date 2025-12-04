import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext();

const AUTH_STORAGE_KEYS = ["token", "userInfo", "tokenTime"];

const clearAuthData = (storage) => {
  AUTH_STORAGE_KEYS.forEach((key) => storage.removeItem(key));
};

export const AuthProvider = ({ children }) => {
  const [userInfo, setUserInfo] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const sources = [
      { storage: localStorage },
      { storage: sessionStorage },
    ];

    for (const { storage } of sources) {
      const token = storage.getItem("token");
      if (!token) continue;

      const savedUserInfo = storage.getItem("userInfo");
      if (savedUserInfo) {
        setUserInfo(JSON.parse(savedUserInfo));
      }
      return;
    }

    clearAuthData(localStorage);
    clearAuthData(sessionStorage);
    navigate("/login", { replace: true });
  }, [navigate]);

  const logout = () => {
    clearAuthData(localStorage);
    clearAuthData(sessionStorage);
    setUserInfo(null);
    navigate("/login", { replace: true });
  };

  return (
    <AuthContext.Provider value={{ userInfo, setUserInfo, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
