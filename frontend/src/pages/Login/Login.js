import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import "../../styles/global.css";
import "../../styles/auth.css"
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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validateEmail = (value) => {
    const regex = /\S+@\S+\.\S+/;
    return regex.test(value);
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
        const response = await axios.post("http://localhost:5000/api/auth/login",
          {
            email,
            password,
          }
        );

        if (response.status === 200) {
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
      } catch (error) {
        if (error.response?.status === 400) {
          setMessage("Tài khoản hoặc mật khẩu không đúng");
        } else if (error.response?.status === 500) {
          setMessage("Lỗi từ server");
        } else {
          setMessage("Lỗi không xác định");
        }
      }
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-panel auth-panel--form">
          <div className="auth-heading">
            <p>Chào mừng đến với FireForecast!</p>
            <h1>Đăng nhập tài khoản</h1>
            <p>Nhập thông tin để tiếp tục quản lý hệ thống cảnh báo.</p>
          </div>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label htmlFor="email" className="auth-label">
                Email <span className="required">*</span>
              </label>
              <div
                className={`auth-input ${errors.email ? "has-error" : ""}`}
                data-error={errors.email}
              >
                <span className="auth-icon">
                  <img src="/assets/mail.png" alt="Mail icon" loading="eager" />
                </span>
                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="Nhập email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrors((prev) => ({ ...prev, email: "" }));
                    setMessage("");
                  }}
                  autoComplete="email"
                />
              </div>
              <span className="auth-error">{errors.email || "\u00A0"}</span>
            </div>

            <div className="auth-field">
              <label htmlFor="password" className="auth-label">
                Mật khẩu <span className="required">*</span>
              </label>
              <div
                className={`auth-input ${errors.password ? "has-error" : ""}`}
              >
                <span className="auth-icon">
                  <img src="/assets/lock.png" alt="Lock icon" loading="eager" />
                </span>
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
                  autoComplete="current-password"
                />
              </div>
              <span className="auth-error">{errors.password || "\u00A0"}</span>
            </div>

            <div className="auth-extra">
              <label className="auth-checkbox">
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
                Ghi nhớ đăng nhập
              </label>
              <Link to="/forgot_password" className="auth-link">
                Quên mật khẩu?
              </Link>
            </div>

            <button type="submit" className="auth-primary-btn">
              Đăng nhập
            </button>
            <span className="auth-error auth-error--center">
              {message || "\u00A0"}
            </span>
          </form>
          
          <div className="auth-switch">
            <span>Chưa có tài khoản?</span>
            <Link to="/register" className="auth-link auth-link--accent">
              Đăng ký ngay
            </Link>
          </div>
        </div>

        <div className="auth-panel auth-panel--hero login-hero">
          <div className="brand">
            <div className="brand-icon">
              <img src="/assets/defence.png" alt="Logo" loading="eager" />
            </div>
            <span>FireForecast</span>
          </div>

          <div className="auth-hero-copy">
            <h2>An toàn phòng cháy</h2>
            <p>
              Theo dõi cảm biến và nhận cảnh báo tức thời để bảo vệ cộng đồng
              của bạn.
            </p>
          </div>

          <div className="auth-illustration">
            <img
              src="/assets/login.png"
              alt="Đăng nhập FireForecast"
              loading="eager"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Login;
