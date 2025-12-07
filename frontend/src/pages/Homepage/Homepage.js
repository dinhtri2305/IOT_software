import React, { useState } from "react";
import { useAuth } from "../../utils/AuthContext";
import Overview from "./components/Overview";
import Analytics from "./components/Analytics";
import Archive from "./components/Archive";
import Settings from "./components/Settings";
import "./Homepage.css";

const Homepage = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("overview"); // tổng quan mặc định
  const { userInfo, logout, token } = useAuth();

  return (
    <div className="app-shell">
      {/* Sidebar trái */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <img src="/assets/defence.png" alt="FireForecast logo" />
          </div>
          <span className="sidebar-title">FireForecast</span>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${
              activeTab === "overview" ? "nav-item--active" : ""
            }`}
            onClick={() => setActiveTab("overview")}
          >
            <span className="nav-icon">
              <img src="/assets/dashboard.png" alt="Tổng quan" />
            </span>
            <span className="nav-label">TỔNG QUAN</span>
          </button>
          <button
            className={`nav-item ${
              activeTab === "analytics" ? "nav-item--active" : ""
            }`}
            onClick={() => setActiveTab("analytics")}
          >
            <span className="nav-icon">
              <img src="/assets/chart.png" alt="Phân tích" />
            </span>
            <span className="nav-label">PHÂN TÍCH</span>
          </button>
          <button
            className={`nav-item ${
              activeTab === "archive" ? "nav-item--active" : ""
            }`}
            onClick={() => setActiveTab("archive")}
          >
            <span className="nav-icon">
              <img src="/assets/security-camera.png" alt="Lưu trữ" />
            </span>
            <span className="nav-label">LƯU TRỮ</span>
          </button>
          <button
            className={`nav-item ${
              activeTab === "settings" ? "nav-item--active" : ""
            }`}
            onClick={() => setActiveTab("settings")}
          >
            <span className="nav-icon">
              <img src="/assets/settings.png" alt="Cài đặt" />
            </span>
            <span className="nav-label">CÀI ĐẶT</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <span className="sidebar-version">Version 1.0.1</span>
        </div>
      </aside>

      {/* Phần nội dung bên phải */}
      <div className="main-area">
        {/* Thanh top bar */}
        <header className="topbar">
          <div className="topbar-left">
            <button className="assistant-chip">
              <span className="assistant-icon">
                <img src="/assets/robot-assistant.png" alt="Hỗ trợ" />
              </span>
              <span>TRỢ LÝ ẢO GEMINI</span>
            </button>
          </div>
          <div className="topbar-right">
            <img
              src="/assets/flag.png"
              alt="Ngôn ngữ"
              className="topbar-flag"
            />
            <div className="user-menu">
              <button
                className="topbar-avatar"
                onClick={() => setIsDropdownOpen((v) => !v)}
              >
                <img src="/assets/user.png" alt="Tài khoản" />
              </button>
              {isDropdownOpen && (
                <div className="user-dropdown">
                  <div className="user-info">
                    <h3>THÔNG TIN NGƯỜI DÙNG</h3>
                    <p>Họ tên: {userInfo?.name || "—"}</p>
                    <p>Email: {userInfo?.email || "—"}</p>
                    <p>Vai trò: admin</p>
                  </div>
                  <button className="logout-button" onClick={logout}>
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Nội dung chính – mỗi tab nav có một content riêng */}
        <main className="content">
          {activeTab === "overview" && <Overview authToken={token} />}

          {activeTab === "analytics" && <Analytics authToken={token} />}

          {activeTab === "archive" && <Archive authToken={token} />}

          {activeTab === "settings" && <Settings authToken={token} />}
        </main>
      </div>
    </div>
  );
};

export default Homepage;
