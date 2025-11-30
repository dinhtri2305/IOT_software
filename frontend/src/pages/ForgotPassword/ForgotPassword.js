import { useState, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import "../../styles/global.css";
import "../../styles/auth.css"
import "./ForgotPassword.css";

function ForgotPassword() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [newpassword, setNewpassword] = useState("");
  const [renewpassword, setRenewpassword] = useState("");
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("");
  const [otpAttempts, setOtpAttempts] = useState(0);

  const otpRefs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
  ];

  // Hàm kiểm tra định dạng email
  const validateEmail = (email) => {
    const regex = /\S+@\S+\.\S+/;
    return regex.test(email);
  };

  // Hàm kiểm tra OTP
  const validateOTP = (otp) => {
    return otp.every(digit => /^\d$/.test(digit));
  };

  // Hàm reset form OTP
  const resetOTPForm = () => {
    setOtp(['', '', '', '', '', '']);
    otpRefs[0].current.focus(); // Focus vào ô đầu tiên
  };

  // Xử lý nhập OTP
  const handleOtpChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    setMessage("");

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setErrors((prev) => ({ ...prev, otp: "" }));

    // Tự động focus vào ô tiếp theo
    if (value !== '' && index < 5) {
      otpRefs[index + 1].current.focus();
    }

    // Kiểm tra nếu đã nhập đủ 6 số
    if (newOtp.every(digit => digit !== '')) {
      // Tự động submit sau 500ms
      setTimeout(async () => {
        if (validateOTP(newOtp)) {
          try {
            const response = await axios.post(
              "http://localhost:3000/api/users/verify-otp",
              {
                email,
                otp: newOtp.join(""),
              }
            );

            if (response.status === 200) {
              sessionStorage.setItem("resetToken", response.data.resetToken);
              setStep(3);
              setOtpAttempts(0);
            }
          } catch (error) {
            setMessageType("error");
            if (error.response.status === 400) {
              const newAttempts = otpAttempts + 1;
              setOtpAttempts(newAttempts);

              if (newAttempts >= 3) {
                setMessage(
                  "Đã nhập sai OTP 3 lần.<br />Chuyển hướng về trang Khôi phục mật khẩu trong 5 giây..."
                );
                setTimeout(() => {
                  window.location.href = "/forgot_password";
                }, 5000);
              } else {
                setMessage(
                  `Nhập sai OTP ${newAttempts} lần. Còn ${3 - newAttempts} lần nhập.`
                );
              }
            } else if (error.response?.status === 500) {
              setMessage("Lỗi từ server");
            } else {
              setMessage("Lỗi không xác định");
            }

            resetOTPForm();
          }
        }
      }, 500);
    }
  };

  // Xử lý khi nhấn backspace
  const handleKeyDown = (index, e) => {
    if (e.key === "Backspace" && otp[index] === "" && index > 0) {
      otpRefs[index - 1].current.focus();
    }
  };

  // Hàm kiểm tra form theo từng bước
  const validateForm = () => {
    const newErrors = {};

    if (step === 1) {
      if (!email.trim()) {
        newErrors.email = "Vui lòng nhập email";
      } else if (!validateEmail(email)) {
        newErrors.email = "Email không hợp lệ";
      }
    } 

    else if (step === 3) {
      if (!newpassword.trim()) {
        newErrors.newpassword = "Vui lòng nhập mật khẩu mới";
      }
      if (!renewpassword.trim()) {
        newErrors.renewpassword = "Vui lòng xác nhận mật khẩu mới";
      } else if (newpassword !== renewpassword) {
        newErrors.renewpassword = "Mật khẩu không khớp";
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (validateForm()) {
      if (step === 1) {
        try {
          const response = await axios.post(
            "http://localhost:3000/api/users/forgot-password",
            {
              email,
            }
          );

          if (response.status === 200) {
            setStep(2);
            setTimeout(() => {
              otpRefs[0].current.focus();
            }, 100);
          }
        } catch (error) {
          setMessageType("error");
          if (error.response?.status === 404) {
            setMessage("Email không tồn tại");
          } else if (error.response?.status === 500) {
            setMessage("Lỗi từ server");
          } else {
            setMessage("Lỗi không xác định");
          }
        }
      } else if (step === 3) {
        try {
          const resetToken = sessionStorage.getItem("resetToken");
          const response = await axios.post(
            "http://localhost:3000/api/users/reset-password",
            {
              email,
              newPassword: newpassword,
            },
            {
              headers: {
                Authorization: `Bearer ${resetToken}`,
              },
            }
          );

          if (response.status === 200) {
            setMessageType("success");
            setMessage(
              "Đổi mật khẩu thành công!<br />Chuyển hướng đến trang Đăng nhập trong 5 giây..."
            );
            sessionStorage.removeItem("resetToken");
            setTimeout(() => {
              navigate("/login");
            }, 5000);
          }
        } catch (error) {
          setMessageType("error");
          if (error.response?.status === 404) {
            setMessage("Không tìm thấy tài khoản với email này");
          } else if (error.response?.status === 500) {
            setMessage("Lỗi từ server");
          } else {
            setMessage("Lỗi kết nối server");
          }
        }
      }
    }
  };

  const renderHeadingSubtitle = () => {
    if (step === 1) {
      return "Nhập email đã đăng ký để nhận mã xác thực khôi phục.";
    }
    if (step === 2) {
      return "Nhập mã OTP gồm 6 chữ số đã được gửi tới email của bạn.";
    }
    return "Tạo mật khẩu mới an toàn để tiếp tục sử dụng FireForecast.";
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-panel auth-panel--form">
          <div className="auth-heading">
            <p>Hỗ trợ mật khẩu</p>
            <h1>Khôi phục tài khoản</h1>
            <p>{renderHeadingSubtitle()}</p>
          </div>

          {step === 1 && (
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-field">
                <label htmlFor="email" className="auth-label">
                  Email <span className="required">*</span>
                </label>
                <div
                  className={`auth-input ${errors.email ? "has-error" : ""}`}
                >
                  <span className="auth-icon">
                    <img src="/assets/mail.png" alt="Email" loading="eager" />
                  </span>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    placeholder="Nhập email khôi phục"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrors((prev) => ({ ...prev, email: "" }));
                      setMessage("");
                    }}
                  />
                </div>
                <span className="auth-error">{errors.email || "\u00A0"}</span>
              </div>

              <button type="submit" className="auth-primary-btn">
                Gửi mã OTP
              </button>
              <span
                className={`auth-error auth-error--center ${
                  messageType === "success" ? "auth-error--success" : ""
                }`}
                dangerouslySetInnerHTML={{ __html: message || "\u00A0" }}
              ></span>
            </form>
          )}

          {step === 2 && (
            <div className="auth-otp-panel">
              <div className="auth-otp-container">
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={otpRefs[index]}
                    type="text"
                    maxLength="1"
                    className="auth-otp-input"
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(index, e)}
                  />
                ))}
              </div>
              <span
                className={`auth-error auth-error--center ${
                  messageType === "success" ? "auth-error--success" : ""
                }`}
                dangerouslySetInnerHTML={{ __html: message || "\u00A0" }}
              ></span>
            </div>
          )}

          {step === 3 && (
            <form onSubmit={handleSubmit} className="auth-form">
              <div className="auth-grid">
                <div className="auth-field">
                  <label htmlFor="new_password" className="auth-label">
                    Mật khẩu mới <span className="required">*</span>
                  </label>
                  <div
                    className={`auth-input ${
                      errors.newpassword ? "has-error" : ""
                    }`}
                  >
                    <span className="auth-icon">
                      <img src="/assets/key.png" alt="Mật khẩu" loading="eager"/>
                    </span>
                    <input
                      type="password"
                      id="new_password"
                      name="new_password"
                      placeholder="Nhập mật khẩu mới"
                      value={newpassword}
                      onChange={(e) => {
                        setNewpassword(e.target.value);
                        setErrors((prev) => ({ ...prev, newpassword: "" }));
                      }}
                    />
                  </div>
                  <span className="auth-error">
                    {errors.newpassword || "\u00A0"}
                  </span>
                </div>

                <div className="auth-field">
                  <label htmlFor="confirm_new_password" className="auth-label">
                    Xác nhận mật khẩu <span className="required">*</span>
                  </label>
                  <div
                    className={`auth-input ${
                      errors.renewpassword ? "has-error" : ""
                    }`}
                  >
                    <span className="auth-icon">
                      <img
                        src="/assets/lock.png"
                        alt="Xác nhận mật khẩu"
                        loading="eager"
                      />
                    </span>
                    <input
                      type="password"
                      id="confirm_new_password"
                      name="confirm_new_password"
                      placeholder="Nhập lại mật khẩu"
                      value={renewpassword}
                      onChange={(e) => {
                        setRenewpassword(e.target.value);
                        setErrors((prev) => ({ ...prev, renewpassword: "" }));
                      }}
                    />
                  </div>
                  <span className="auth-error">
                    {errors.renewpassword || "\u00A0"}
                  </span>
                </div>
              </div>

              <button type="submit" className="auth-primary-btn">
                Khôi phục mật khẩu
              </button>
              <span
                className={`auth-error auth-error--center ${
                  messageType === "success" ? "auth-error--success" : ""
                }`}
                dangerouslySetInnerHTML={{ __html: message || "\u00A0" }}
              ></span>
            </form>
          )}
          
          <div className="auth-switch">
            <span>Nhớ mật khẩu rồi?</span>
            <Link to="/login" className="auth-link auth-link--accent">
              Đăng nhập
            </Link>
          </div>
        </div>

        <div className="auth-panel auth-panel--hero forgot-hero">
          <div className="brand">
            <div className="brand-icon">
              <img src="/assets/defence.png" alt="Logo" loading="eager" />
            </div>
            <span>FireForecast</span>
          </div>

          <div className="auth-hero-copy">
            <h2>Khôi phục an toàn</h2>
            <p>
              Đặt lại mật khẩu của bạn chỉ trong vài bước và tiếp tục theo dõi hệ
              thống cảnh báo cháy mọi lúc mọi nơi.
            </p>
          </div>

          <div className="auth-illustration">
            <img
              src="/assets/forgot-pass.png"
              alt="Khôi phục mật khẩu"
              loading="eager"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPassword;
