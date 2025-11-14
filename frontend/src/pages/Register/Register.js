import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../App.css';
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

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>HotelManager</h1>
        </div>
      </header>

      <main className="main-content">
        <div className="header-container">
          <h2>Đăng ký</h2>
          <Link to="/login" className="back-button">
            <img src="/icons/Navigate.png" alt="Back" />
          </Link>
        </div>

        <div className="register-container">
          {step === 1 && (
            <div className="register-card">
              <form onSubmit={handleSubmit}>
                <div className="grid-container">
                  <div className="form-group_name_reg">
                    <label htmlFor="name">
                      Họ và tên <span className="required">*</span>
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      placeholder="Nhập họ và tên của bạn"
                      value={name}
                      onChange={(e) => {
                        setName(e.target.value);
                        setErrors((prev) => ({ ...prev, name: '' }));
                        setMessage("")
                      }}
                    />
                    {/* Luôn render span để dành chỗ */}
                    <span className="error-message_reg">{errors.name || "\u00A0"}</span>
                  </div>

                  <div className="form-group_email_reg">
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
                        setErrors((prev) => ({ ...prev, email: '' }));
                        setMessage("")
                      }}
                    />
                    <span className="error-message_reg">{errors.email || "\u00A0"}</span>
                  </div>

                  <div className="form-group_pass_reg">
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
                        setErrors((prev) => ({ ...prev, password: '' }));
                        setMessage("")
                      }}
                    />
                    <span className="error-message_reg">{errors.password || "\u00A0"}</span>
                  </div>

                  <div className="form-group_confirm_pass_reg">
                    <label htmlFor="confirm_password">
                      Xác nhận mật khẩu <span className="required">*</span>
                    </label>
                    <input
                      type="password"
                      id="confirm_password"
                      name="confirm_password"
                      placeholder="Nhập lại mật khẩu"
                      value={repassword}
                      onChange={(e) => {
                        setRepassword(e.target.value);
                        setErrors((prev) => ({ ...prev, repassword: '' }));
                        setMessage("")
                      }}
                    />
                    <span className="error-message_reg">{errors.repassword || "\u00A0"}</span>
                  </div>
                </div>

                <div className="checkbox-group">
                  <input
                    type="checkbox"
                    id="acceptance"
                    name="acceptance"
                    checked={acceptance}
                    onChange={(e) => {
                      setAcceptance(e.target.checked);
                      setErrors((prev) => ({ ...prev, acceptance: '' }));
                      setMessage("")
                    }}
                  />
                  <label htmlFor="acceptance">
                    Tôi đồng ý với điều khoản sử dụng và chính sách bảo mật <span className="required">*</span>
                  </label>
                </div>
                <span className="error-message_reg">
                  {errors.acceptance || "\u00A0"}
                </span>

                <button type="submit" className="register-button">
                  Đăng ký
                </button>
                <span className={`error-message-register ${messageType}`} dangerouslySetInnerHTML={{ __html: message || "\u00A0" }}></span>
              </form>

              <div className="login">
                <span>Đã có tài khoản? </span>
                <Link to="/login">Đăng nhập</Link>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="register-card register-card-otp">
              <form>
                <div className="register-form-otp">
                  <label>Nhập mã OTP <span className="required">*</span></label>
                  <div className="register-warning-message">
                  Chức năng OTP đang được cải tiến. Vui lòng lấy mã OTP trong console.
                  </div>
                  <div className="register-otp-container">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        ref={otpRefs[index]}
                        type="text"
                        maxLength="1"
                        className="register-otp-input"
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                      />
                    ))}
                  </div>
                  <span className={`error-message-register ${messageType}`} dangerouslySetInnerHTML={{ __html: message || "\u00A0" }}></span>
                </div>
              </form>
            </div>
          )}

          </div>
      </main>
    </div>
  );
}

export default Register;