import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../App.css';
import './ForgotPassword.css';

function ForgotPassword() {
  const navigate = useNavigate();
  // Khai báo state cho các trường nhập liệu
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [newpassword, setNewpassword] = useState('');
  const [renewpassword, setRenewpassword] = useState('');
  const [errors, setErrors] = useState({});
  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
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
          try {
            const response = await axios.post('http://localhost:5000/api/users/verify-otp', {
              email,
              otp: newOtp.join('')
            });

            if (response.status === 200) {
              console.log("Xác thực OTP thành công");
              sessionStorage.setItem('resetToken', response.data.resetToken);
              setStep(3);
              setOtpAttempts(0); // Reset số lần thử khi thành công
            }
          }

          catch (error) {
            setMessageType('error');
            if (error.response.status === 400) {
              const newAttempts = otpAttempts + 1;
              setOtpAttempts(newAttempts);
              
              if (newAttempts >= 3) {
                console.log("Đã nhập sai OTP 3 lần");
                setMessage("Đã nhập sai OTP 3 lần.<br />Chuyển hướng về trang Khôi phục mật khẩu trong 5 giây...");
                setTimeout(() => {
                  window.location.href = '/forgot_password';
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

  // Hàm kiểm tra form theo từng bước
  const validateForm = () => {
    const newErrors = {};

    if (step === 1) {
      if (!email.trim()) {
        newErrors.email = 'Vui lòng nhập email';
      } else if (!validateEmail(email)) {
        newErrors.email = 'Email không hợp lệ';
      }
    } 

    else if (step === 3) {
      if (!newpassword.trim()) {
        newErrors.newpassword = 'Vui lòng nhập mật khẩu mới';
      }
      if (!renewpassword.trim()) {
        newErrors.renewpassword = 'Vui lòng xác nhận mật khẩu mới';
      } else if (newpassword !== renewpassword) {
        newErrors.renewpassword = 'Mật khẩu không khớp';
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
          const response = await axios.post('http://localhost:5000/api/users/forgot-password', {
            email
          });
          
          if (response.status === 200) {
            console.log("Mã OTP đã được gửi đến email của bạn");
            setStep(2);
            // Focus vào ô OTP đầu tiên và hiện message hướng dẫn
            setTimeout(() => {
              otpRefs[0].current.focus();
            }, 100); // Đợi một chút để đảm bảo DOM đã được cập nhật
          }
        }  
        
        catch (error) {
          setMessageType('error');
          if (error.response.status === 404) {
            console.log("Email không tồn tại");
            setMessage("Email không tồn tại");
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
      } else if (step === 3) {
        try {
          const resetToken = sessionStorage.getItem('resetToken');
          const response = await axios.post('http://localhost:5000/api/users/reset-password', {
            email,
            newPassword: newpassword
          }, {
            headers: {
              'Authorization': `Bearer ${resetToken}`
            }
          });

          if (response.status === 200) {
            setMessageType('success');
            setMessage('Đổi mật khẩu thành công!<br />Chuyển hướng đến trang Đăng nhập trong 5 giây...');
            sessionStorage.removeItem('resetToken');
            setTimeout(() => {
              navigate('/login');
            }, 5000);
          }
        } 
        
        catch (error) {
          setMessageType('error');
          if (error.response.status === 404) {
            console.log("Không tìm thấy tài khoản với email này");
            setMessage("Không tìm thấy tài khoản với email này");
          }
          
          else if (error.response.status === 500) {
            console.log("Lỗi từ server");
            setMessage("Lỗi từ server");
          } 
          
          else {
            setMessage('Lỗi kết nối server');
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

      <main className="forgot-main-content">
        <div className="forgot-header-container">
          <h2>Khôi phục mật khẩu</h2>
          <Link to="/login" className="back-button">
            <img src="/icons/Navigate.png" alt="Back"/>
          </Link>
        </div>

        <div className="forgot-container">
          {step === 1 && (
            <div className="forgot-card forgot-card-email">
              <form onSubmit={handleSubmit}>
                <div className="forgot-form-email">
                  <label htmlFor="email">Email <span className="forgot-required">*</span></label>
                  <input 
                    type="email" 
                    id="email" 
                    name="email" 
                    placeholder="Nhập email khôi phục"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErrors((prev) => ({ ...prev, email: '' }));
                      setMessage('');
                    }}
                  />
                  <span className="forgot-error-message">{errors.email || "\u00A0"}</span>
                </div>
                <button type="submit" className="forgot-button" id='email'>
                  Gửi mã OTP
                </button>
                <span className={`forgot-message ${messageType}`} dangerouslySetInnerHTML={{ __html: message || "\u00A0" }}></span>
              </form>
            </div>
          )}

          {step === 2 && (
            <div className="forgot-card forgot-card-otp">
              <form>
                <div className="forgot-form-otp">
                  <label>Nhập mã OTP <span className="forgot-required">*</span></label>
                  <div className="forgot-warning-message">
                    Chức năng OTP đang được cải tiến. Vui lòng lấy mã OTP trong console.
                  </div>
                  <div className="forgot-otp-container">
                    {otp.map((digit, index) => (
                      <input
                        key={index}
                        ref={otpRefs[index]}
                        type="text"
                        maxLength="1"
                        className="forgot-otp-input"
                        value={digit}
                        onChange={(e) => handleOtpChange(index, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(index, e)}
                      />
                    ))}
                  </div>
                  <span className={`forgot-message ${messageType}`} dangerouslySetInnerHTML={{ __html: message || "\u00A0" }}></span>
                </div>
              </form>
            </div>
          )}

          {step === 3 && (
            <div className="forgot-card forgot-card-password">
              <form onSubmit={handleSubmit}>
                <div className="forgot-form-pass">
                  <label htmlFor="new_password">Mật khẩu mới <span className="forgot-required">*</span></label>
                  <input 
                    type="password" 
                    id="new_password" 
                    name="new_password" 
                    placeholder="Nhập mật khẩu mới" 
                    value={newpassword}
                    onChange={(e) => {
                      setNewpassword(e.target.value);
                      setErrors((prev) => ({ ...prev, newpassword: '' }));
                    }}
                  />
                  <span className="forgot-error-message">{errors.newpassword || "\u00A0"}</span>
                </div>

                <div className="forgot-form-pass">
                  <label htmlFor="confirm_new_password">Xác nhận mật khẩu <span className="forgot-required">*</span></label>
                  <input 
                    type="password" 
                    id="confirm_new_password" 
                    name="confirm_new_password" 
                    placeholder="Nhập lại mật khẩu" 
                    value={renewpassword}
                    onChange={(e) => {
                      setRenewpassword(e.target.value);
                      setErrors((prev) => ({ ...prev, renewpassword: '' }));
                    }}
                  />
                  <span className="forgot-error-message">{errors.renewpassword || "\u00A0"}</span>
                </div>

                <button type="submit" className="forgot-button" id='password'>
                  Khôi phục mật khẩu
                </button>
                <span className={`forgot-message ${messageType}`} dangerouslySetInnerHTML={{ __html: message || "\u00A0" }}></span>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default ForgotPassword;
