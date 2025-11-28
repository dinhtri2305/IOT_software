import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../../styles/global.css';
import "../../styles/auth.css"
import './Register.css';

function Register() {
  const navigate = useNavigate();
  // Khai báo state cho các trường nhập liệu
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repassword, setRepassword] = useState('');
  const [acceptance, setAcceptance] = useState(false);
  const [errors, setErrors] = useState({});
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState(''); 
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [step, setStep] = useState(1); 
  const [otpAttempts, setOtpAttempts] = useState(0); // Đếm số lần nhập sai OTP

  // Refs cho các ô input OTP
  const otpRefs = [
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null),
    useRef(null)
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

    setMessage('');

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setErrors(prev => ({ ...prev, otp: '' }));

    // Tự động focus vào ô tiếp theo
    if (value !== '' && index < 5) {
      otpRefs[index + 1].current.focus();
    }

    // Kiểm tra nếu đã nhập đủ 6 số
    if (newOtp.every(digit => digit !== '')) {
      // Tự động submit sau 500ms
      setTimeout(async () => {
        if (validateOTP(newOtp)) {
          // Complete registration
          try {
            const registerResponse = await axios.post('http://localhost:5000/api/auth/verify-registration-otp', {
              email,
              otp: newOtp.join('')
            });

            if (registerResponse.status === 201) {
              console.log("Tài khoản đã được tạo thành công!");
              setMessageType('success');
              setMessage("Đăng ký thành công! <br />Chuyển hướng đến trang Đăng nhập trong vòng 5 giây...");
              setTimeout(() => {
                navigate("/login");
              }, 5000);
            }
          } 

          catch (error) {
            setMessageType('error');
            if (error.response.status === 400) {
              const newAttempts = otpAttempts + 1;
              setOtpAttempts(newAttempts);
              
              if (newAttempts >= 3) {
                console.log("Đã nhập sai OTP 3 lần");
                setMessage("Đã nhập sai OTP 3 lần.<br />Chuyển hướng về trang Đăng ký trong 5 giây...");
                setTimeout(() => {
                  window.location.href = '/register';
                }, 5000);
              } 

              else {
                console.log(`Nhập sai OTP ${newAttempts} lần. Còn ${3 - newAttempts} lần nhập.`);
                setMessage(`Nhập sai OTP ${newAttempts} lần. Còn ${3 - newAttempts} lần nhập.`);
              }
            } 
            
            else if (error.response.status === 500) {
              console.log("Lỗi từ server");
              setMessage("Lỗi từ server");
            } 
            
            else {
              console.log("Lỗi không xác định");
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
    if (e.key === 'Backspace' && otp[index] === '' && index > 0) {
      otpRefs[index - 1].current.focus();
    }
  };

  // Hàm kiểm tra form, cập nhật lỗi vào state errors
  const validateForm = () => {
    const newErrors = {};

    if (step === 1) {
      if (!name.trim()) {
        newErrors.name = 'Vui lòng nhập họ và tên';
      }
      if (!email.trim()) {
        newErrors.email = 'Vui lòng nhập email';
      } else if (!validateEmail(email)) {
        newErrors.email = 'Email không hợp lệ';
      }
      if (!password.trim()) {
        newErrors.password = 'Vui lòng nhập mật khẩu';
      }
      if (!repassword.trim()) {
        newErrors.repassword = 'Vui lòng xác nhận mật khẩu';
      } else if (password !== repassword) {
        newErrors.repassword = 'Mật khẩu không khớp';
      }
      if (!acceptance) {
        newErrors.acceptance = 'Bạn cần đồng ý với điều khoản và chính sách bảo mật';
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
          const response = await axios.post("http://localhost:5000/api/auth/register", {
            name,
            email,
            password,
            role: "admin"
          });
          
          if (response.status === 200) {
            console.log("Mã OTP đã được gửi đến email của bạn");
            setStep(2);
            setTimeout(() => {
              otpRefs[0].current.focus();
            }, 100); // Đợi một chút để đảm bảo DOM đã được cập nhật
          }   
        } 
        catch (error) {
          setMessageType('error');

          if (error.response.status === 400) {
            console.log("Email không hợp lệ hoặc đã tồn tại. Vui lòng chọn email khác.");
            setMessage("Email không hợp lệ hoặc đã tồn tại. Vui lòng chọn email khác.")
          }
    
          else if (error.response.status === 500) {
            console.log("Lỗi từ server");
            setMessage("Lỗi từ server")
          }
    
          else {
            console.log("Lỗi không xác định");
            setMessage("Lỗi không xác định")
          }
        }
      }
    }
  };

  const renderHeadingSubtitle = () => {
    if (step === 1) {
      return "Hoàn tất thông tin để nhận cảnh báo và quản lý thiết bị.";
    }
    return "Nhập mã OTP gồm 6 chữ số đã được gửi tới email của bạn.";
  };

  return (
    <div className="auth-page">
      <div className="auth-shell" id="register">
        <div className="auth-panel auth-panel--form">
          <div className="auth-heading">
            <p>Xin chào!</p>
            <h1>Tạo tài khoản mới</h1>
            <p>{renderHeadingSubtitle()}</p>
          </div>

          {step === 1 && (
            <>
              <form onSubmit={handleSubmit} className="auth-form">
                <div className="auth-grid register-grid-two">
                  <div className="auth-field">
                    <label htmlFor="name" className="auth-label">
                      Họ và tên <span className="required">*</span>
                    </label>
                    <div
                      className={`auth-input ${errors.name ? "has-error" : ""}`}
                    >
                      <span className="auth-icon">
                        <img src="/assets/id-card.png" alt="Name" loading="eager"/>
                      </span>
                      <input
                        type="text"
                        id="name"
                        name="name"
                        placeholder="Nhập họ và tên"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value);
                          setErrors((prev) => ({ ...prev, name: "" }));
                          setMessage("");
                        }}
                      />
                    </div>
                    <span className="auth-error">{errors.name || "\u00A0"}</span>
                  </div>

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
                        placeholder="Nhập email"
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

                  <div className="auth-field">
                    <label htmlFor="password" className="auth-label">
                      Mật khẩu <span className="required">*</span>
                    </label>
                    <div
                      className={`auth-input ${errors.password ? "has-error" : ""}`}
                    >
                      <span className="auth-icon">
                        <img src="/assets/key.png" alt="Password" loading="eager" />
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
                      />
                    </div>
                    <span className="auth-error">
                      {errors.password || "\u00A0"}
                    </span>
                  </div>

                  <div className="auth-field">
                    <label htmlFor="confirm_password" className="auth-label">
                      Xác nhận mật khẩu <span className="required">*</span>
                    </label>
                    <div
                      className={`auth-input ${errors.repassword ? "has-error" : ""}`}
                    >
                      <span className="auth-icon">
                        <img src="/assets/lock.png" alt="Confirm" loading="eager" />
                      </span>
                      <input
                        type="password"
                        id="confirm_password"
                        name="confirm_password"
                        placeholder="Nhập lại mật khẩu"
                        value={repassword}
                        onChange={(e) => {
                          setRepassword(e.target.value);
                          setErrors((prev) => ({ ...prev, repassword: "" }));
                          setMessage("");
                        }}
                      />
                    </div>
                    <span className="auth-error">
                      {errors.repassword || "\u00A0"}
                    </span>
                  </div>
                </div>
                
                <div className="register-confirm">
                  <label className="auth-checkbox">
                    <input
                      type="checkbox"
                      id="acceptance"
                      name="acceptance"
                      checked={acceptance}
                      onChange={(e) => {
                        setAcceptance(e.target.checked);
                        setErrors((prev) => ({ ...prev, acceptance: "" }));
                        setMessage("");
                      }}
                    />
                    Tôi đồng ý với điều khoản và chính sách bảo mật{" "}
                    <span className="required">*</span>
                  </label>
                </div>
                <span className="auth-error">
                  {errors.acceptance || "\u00A0"}
                </span>
                
                
                <button type="submit" className="auth-primary-btn">
                  Đăng ký
                </button>
                <span
                  className={`auth-error auth-error--center ${
                    messageType === "success" ? "auth-error--success" : ""
                  }`}
                  dangerouslySetInnerHTML={{ __html: message || "\u00A0" }}
                ></span>
              </form>
            </>
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
          
          <div className="auth-switch">
            <span>Đã có tài khoản?</span>
            <Link to="/login" className="auth-link auth-link--accent">
              Đăng nhập
            </Link>
          </div>
        </div>

        <div className="auth-panel auth-panel--hero register-hero">
          <div className="brand">
            <div className="brand-icon">
              <img src="/assets/defence.png" alt="Logo" loading="eager" />
            </div>
            <span>FireForecast</span>
          </div>

          <div className="auth-hero-copy">
            <h2>Bảo vệ an toàn dữ liệu</h2>
            <p>
              Đăng ký để đồng bộ hệ thống, quản lý người dùng và kích hoạt các
              cảnh báo phòng cháy tức thời.
            </p>
          </div>

          <div className="auth-illustration">
            <img
              src="/assets/register.png"
              alt="Đăng ký FireForecast"
              loading="eager"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default Register;