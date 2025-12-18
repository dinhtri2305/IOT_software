import { createContext, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";

const AuthContext = createContext();

const AUTH_STORAGE_KEYS = ["token", "userInfo", "tokenTime"];

const clearAuthData = (storage) => {
  AUTH_STORAGE_KEYS.forEach((key) => storage.removeItem(key));
};

export const AuthProvider = ({ children }) => {
  const [userInfo, setUserInfo] = useState(null);
  const [token, setToken] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const sources = [
      { storage: localStorage },
      { storage: sessionStorage },
    ];

    for (const { storage } of sources) {
      const savedToken = storage.getItem("token");
      if (!savedToken) continue;

      setToken(savedToken);
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

  const logout = async () => {
    try {
      const token = localStorage.getItem("token") || sessionStorage.getItem("token");
      const response = await axios.post("http://localhost:3000/api/auth/logout", {
        token,
      });
  
      if (response.status === 200) {
        // Xóa dữ liệu lưu trữ
        clearAuthData(localStorage);
        clearAuthData(sessionStorage);
  
        // Reset state
        setUserInfo(null);
  
        // Điều hướng về trang login
        navigate("/login", { replace: true });
      }
    } catch (error) {
        if (error.response?.status === 400) {
          alert("Đăng xuất không thành công");
        } else if (error.response?.status === 500) {
          alert("Lỗi từ server");
        } else {
          alert("Lỗi không xác định");
        }
      }
    };  

  return (
    <AuthContext.Provider value={{ userInfo, setUserInfo, logout, token }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
