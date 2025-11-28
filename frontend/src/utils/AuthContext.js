import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const AuthContext = createContext();

const EXPIRED_TIME = 12 * 60 * 60 * 1000; // 12 tiếng, tính bằng milliseconds
const AUTH_STORAGE_KEYS = ["token", "userInfo", "tokenTime"];

// Hàm kiểm tra token có quá hạn hay không
const isTokenExpired = () => {
  const tokenTime = localStorage.getItem("tokenTime");
  if (!tokenTime) return true;
  return Date.now() - parseInt(tokenTime) > EXPIRED_TIME;
};

const clearAuthData = (storage) => {
  AUTH_STORAGE_KEYS.forEach((key) => storage.removeItem(key));
};

export const AuthProvider = ({ children }) => {
  const [userInfo, setUserInfo] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const sources = [
      { storage: localStorage, requireExpiryCheck: true },
      { storage: sessionStorage, requireExpiryCheck: false },
    ];

    for (const { storage, requireExpiryCheck } of sources) {
      const token = storage.getItem("token");
      if (!token) continue;

      if (requireExpiryCheck && isTokenExpired()) {
        clearAuthData(storage);
        continue;
      }

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
