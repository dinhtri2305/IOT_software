import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import "../App.css";
import "./Login.css";

function Login() {
  const navigate = useNavigate();
  // Khai báo state cho các trường nhập liệu
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState("");

  // Kiểm tra token khi vào trang
  useEffect(() => {
    const token =
      localStorage.getItem("token") || sessionStorage.getItem("token");
    if (token) {
      navigate("/HomePage");
      // navigate("/");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Hàm kiểm tra định dạng email
  const validateEmail = (email) => {
    const regex = /\S+@\S+\.\S+/;
    return regex.test(email);
  };

  // Hàm kiểm tra form
  const validateForm = () => {
    const newErrors = {};

    if (!email.trim()) {
      newErrors.email = "Vui lòng nhập email";
    } else if (!validateEmail(email)) {
      newErrors.email = "Email không hợp lệ";
    }

    if (!password.trim()) {
      newErrors.password = "Vui lòng nhập mật khẩu";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (validateForm()) {
      try {
        const response = await axios.post("http://localhost:5000/api/auth/login", {
          email,
          password
        });
        
        if (response.status === 200) {
          console.log("Đăng nhập thành công");
          
          // Xử lý remember me
          if (remember) {
            // Nếu remember -> lưu vào localStorage
            localStorage.setItem("token", response.data.token);
            localStorage.setItem("userInfo", JSON.stringify(response.data.user));
            localStorage.setItem("tokenTime", Date.now().toString()); // Lưu thời gian đăng nhập
          } else {
            // Nếu không remember -> lưu vào sessionStorage
            sessionStorage.setItem("token", response.data.token);
            sessionStorage.setItem("userInfo", JSON.stringify(response.data.user));
          }
          
          navigate("/HomePage");
        }   
      } 

      catch (error) {
        if (error.response.status === 400) {
          console.log("");
          setMessage("Tài khoản hoặc mật khẩu không đúng");
        }
        
        else if (error.response.status === 500) {
          console.log("Lỗi từ server");
          setMessage("Lỗi từ server");
        }

        else {
          console.log("Lỗi không xác định");
          setMessage("Lỗi không xác định");
        }
      }
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>HotelManager</h1>
        </div>
      </header>

      <main className="main-content">
        <div className="header-container">
          <h2>Đăng nhập</h2>
        </div>

        <div className="login-container">
          <div className="login-card">
            <form onSubmit={handleSubmit}>
              <div className="form-group_email">
                <label htmlFor="email">
                  Email <span className="required">*</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="Nhập email của bạn"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrors((prev) => ({ ...prev, email: "" }));
                    setMessage("");
                  }}
                />
                <span className="error-message_log">
                  {errors.email || "\u00A0"}
                </span>
              </div>

              <div className="form-group_pass">
                <label htmlFor="password">
                  Mật khẩu <span className="required">*</span>
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrors((prev) => ({ ...prev, password: "" }));
                    setMessage("");
                  }}
                />
                <span className="error-message_log">
                  {errors.password || "\u00A0"}
                </span>
              </div>

              <div className="checkbox-group">
                <input
                  type="checkbox"
                  id="remember"
                  name="remember"
                  checked={remember}
                  onChange={(e) => {
                    setRemember(e.target.checked);
                    setMessage("");
                  }}
                />
                <label htmlFor="remember">Ghi nhớ đăng nhập</label>
              </div>

              <button type="submit" className="login-button">
                Đăng nhập
              </button>
              <span className="error-message_log">{message || "\u00A0"}</span>
            </form>

            <div className="forgot-password">
              <Link to="/forgot_password">Quên mật khẩu?</Link>
            </div>

            <div className="register">
              <span>Chưa có tài khoản? </span>
              <Link to="/register">Đăng ký ngay</Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Login;
