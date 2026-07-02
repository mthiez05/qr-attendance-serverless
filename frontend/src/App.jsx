import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { LogIn, User, GraduationCap, LogOut, LayoutDashboard, Calendar, BarChart3, Settings, HelpCircle, Search, CheckCircle2, AlertCircle, Compass, Clock, MapPin, UserCheck, ShieldAlert } from 'lucide-react';
// 👉 ĐÃ THÊM: Import thư viện tạo mã QR thực tế
import { QRCodeCanvas } from 'qrcode.react';
const API_BASE =
  "https://cwrtzn0vg5.execute-api.ap-southeast-1.amazonaws.com/dev";
export default function App() {
  // Trạng thái đăng nhập hệ thống
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [role, setRole] = useState(''); // STUDENT hoặc TEACHER
  const [userId, setUserId] = useState('');
  const [userEmail, setUserEmail] = useState('');

  const [inputEmail, setInputEmail] = useState('');
  const [inputPassword, setInputPassword] = useState('');
  const [currentTab, setCurrentTab] = useState('dashboard');

  // State xử lý của Sinh viên
  const [scanResult, setScanResult] = useState('');
  const scannerRef = useRef(null);
  const [location, setLocation] = useState({ lat: null, lon: null });
  const [status, setStatus] = useState({ type: '', message: '' });

  // State xử lý của Giảng viên
  const [teacherToken, setTeacherToken] = useState('CHƯA TẠO MÃ');
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [gpsStatus, setGpsStatus] = useState('');
  const [buttonState, setButtonState] = useState('Kích hoạt / Làm mới mã QR');

  // Danh sách sinh viên thực tế (Bắt đầu bằng mảng rỗng)
  const [attendanceList, setAttendanceList] = useState([]);

  // Xử lý Đăng nhập
  const handleLogin = (e) => {
    e.preventDefault();
    if (!inputEmail || !inputPassword) {
      alert('Vui lòng nhập đầy đủ thông tin!');
      return;
    }

    setUserEmail(inputEmail);

    // Phân quyền cơ bản dựa trên email nhập vào
    if (inputEmail.includes('teacher') || inputEmail === 'gv@truong.edu.vn') {
      setRole('TEACHER');
      setUserId('GV001');
      setIsLoggedIn(true);
      setAttendanceList([
        { name: 'Nguyễn Văn A', id: 'SV01', time: '07:32', status: 'Hợp lệ' },
        { name: 'Trần Thị B', id: 'SV02', time: '07:35', status: 'Hợp lệ' }
      ]);
    } else {
      setRole('STUDENT');
      setUserId('SV2026');
      setIsLoggedIn(true);
    }
  };

  const handleLogOut = () => {
    setIsLoggedIn(false);
    setRole('');
    setUserId('');
    setUserEmail('');
    setInputEmail('');
    setInputPassword('');
    setScanResult('');
    setTeacherToken('CHƯA TẠO MÃ');
    setCountdown(0);
    setAttendanceList([]);
    setStatus({ type: '', message: '' });
    setGpsStatus('');
    setButtonState('Kích hoạt / Làm mới mã QR');
    setCurrentTab('dashboard');
  };

  // Vị trí GPS Sinh viên
 useEffect(() => {
  if (
    isLoggedIn &&
    role === "STUDENT" &&
    currentTab === "dashboard" &&
    navigator.geolocation
  ) {
    console.log("Đang lấy GPS...");

    navigator.geolocation.getCurrentPosition(
      (position) => {
        console.log("GPS SUCCESS");
        console.log("LAT =", position.coords.latitude);
        console.log("LON =", position.coords.longitude);

        setLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });

        setStatus({
          type: "",
          message: "",
        });
      },
      (error) => {
        console.log("GPS ERROR");
        console.log(error);

        setStatus({
          type: "error",
          message: "Vui lòng bật quyền truy cập GPS trên thiết bị!",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  }
}, [isLoggedIn, role, currentTab]);

  // Quét QR Sinh viên
  useEffect(() => {
    if (isLoggedIn && role === 'STUDENT' && currentTab === 'dashboard' && !scanResult) {
      const scanner = new Html5QrcodeScanner('reader-viewport', {
        fps: 15,
        qrbox: { width: 250, height: 250 },
        rememberLastUsedCamera: true,
        supportedScanTypes: [0]
      });
      scannerRef.current = scanner;
      scanner.render(
        async (text) => {

          if (scannerRef.current) {
            const currentScanner = scannerRef.current;
            scannerRef.current = null;

            await currentScanner.clear().catch(() => { });
          }

          setScanResult(text);

          await handleAttendanceRef.current(text);

        },
        () => { }
      );

      return () => {

        if (scannerRef.current) {

          const currentScanner = scannerRef.current;

          scannerRef.current = null;

          currentScanner
            .clear()
            .catch(err => {
              console.error(err);
            });

        }

      };
    }
  }, [isLoggedIn, role, scanResult, currentTab]);




  const handleAttendance = async (qrData) => {
    console.log("LOCATION =", location);
    console.log("STATE LAT =", location.lat);
    console.log("STATE LON =", location.lon);
    if (!location.lat || !location.lon) {
      setStatus({
        type: "error",
        message: "Chưa lấy được vị trí GPS"
      });
      return;
    }

    try {
      const qr = JSON.parse(qrData);

      const response = await fetch(
        `${API_BASE}/student/check-in`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            student_id: userId,
            class_id: qr.class_id,
            token: qr.token,
            student_lat: location.lat,
            student_lon: location.lon
          })
        }
      );

      const data = await response.json();

      if (response.ok) {
        setStatus({
          type: "success",
          message:
            data.message || "Điểm danh thành công"
        });

        console.log("Attendance success:", data);
      } else {
        setStatus({
          type: "error",
          message:
            data.message || "Điểm danh thất bại"
        });
      }
    } catch (error) {
      console.error(error);

      setStatus({
        type: "error",
        message: "Lỗi xử lý QR hoặc kết nối API"
      });
    }
  };

  const handleAttendanceRef = useRef(handleAttendance);
  handleAttendanceRef.current = handleAttendance;




  // Giảng viên sinh mã OTP-QR


  const handleCreateClassQR = async () => {
    try {
      setLoading(true);
      setButtonState('Đang lấy GPS...');
      setGpsStatus('Đang lấy vị trí GPS...');
      setStatus({ type: '', message: '' });

      const position = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("GeolocNotSupported"));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve(pos),
          (err) => reject(err),
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
          }
        );
      });

      const teacherLatitude = position.coords.latitude;
      const teacherLongitude = position.coords.longitude;

      setGpsStatus('GPS sẵn sàng.');
      setButtonState('Đang tạo QR...');

      // DEBUG START
      console.log("Teacher GPS before POST");
      console.log("latitude =", teacherLatitude);
      console.log("longitude =", teacherLongitude);
      // DEBUG END

      const response = await fetch(
        `${API_BASE}/teacher/create-class`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            class_id: "SE330",
            latitude: teacherLatitude,
            longitude: teacherLongitude
          })
        }
      );

      const data = await response.json();

      if (response.ok) {
        setTeacherToken(data.token);
        setCountdown(30);
        setStatus({ type: '', message: '' });
      } else {
        setStatus({
          type: "error",
          message: data.message || "Không tạo được QR"
        });
      }

    } catch (error) {
      console.error(error);
      setGpsStatus('Không lấy được GPS.');

      let errorMessage = "Không lấy được GPS.";
      if (error.code === 1) { // PERMISSION_DENIED
        errorMessage = "Quyền truy cập GPS bị từ chối. Vui lòng bật định vị!";
      } else if (error.code === 2) { // POSITION_UNAVAILABLE
        errorMessage = "Vị trí GPS không khả dụng!";
      } else if (error.code === 3) { // TIMEOUT
        errorMessage = "Hết thời gian tìm vị trí GPS (10s)!";
      } else if (error.message === "GeolocNotSupported") {
        errorMessage = "Trình duyệt của bạn không hỗ trợ định vị GPS!";
      } else {
        errorMessage = "Lỗi xử lý: " + (error.message || "Không tạo được QR");
      }

      setStatus({
        type: "error",
        message: errorMessage
      });
    } finally {
      setLoading(false);
      setButtonState('Kích hoạt / Làm mới mã QR');
    }
  };

  useEffect(() => {
    if (countdown > 0 && currentTab === 'dashboard') {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0 && teacherToken !== 'CHƯA TẠO MÃ' && currentTab === 'dashboard') {
      handleCreateClassQR();
    }
  }, [countdown, currentTab]);

  // Lấy chữ cái đầu của email để làm avatar động
  const getAvatarText = (email) => {
    if (!email) return "U";
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <div className="min-h-screen bg-[#0A0F1E] text-slate-200 font-sans flex flex-col justify-between selection:bg-emerald-500/30">

      {/* 1. MÀN HÌNH ĐĂNG NHẬP */}
      {!isLoggedIn ? (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#111827] rounded-2xl p-8 shadow-2xl border border-white/10">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-emerald-500/20">
                <GraduationCap size={36} />
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-white">AttendancePro</h1>
              <p className="text-xs text-slate-400 mt-1">Hệ thống quản lý điểm danh Dynamic Cloud QR</p>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Email Trường</label>
                <input
                  type="email"
                  placeholder="Ví dụ: gv@truong.edu.vn hoặc sv@truong.edu.vn"
                  value={inputEmail}
                  onChange={(e) => setInputEmail(e.target.value)}
                  className="w-full bg-[#0A0F1E] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 font-medium transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Mật khẩu</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={inputPassword}
                  onChange={(e) => setInputPassword(e.target.value)}
                  className="w-full bg-[#0A0F1E] border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 font-medium transition"
                  required
                />
              </div>

              <button type="submit" className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 font-semibold py-3 rounded-xl text-white flex items-center justify-center gap-2 mt-2 cursor-pointer shadow-lg shadow-emerald-900/20 transition duration-200 active:scale-95">
                <LogIn size={18} /> Đăng nhập hệ thống
              </button>
            </form>
          </div>
        </div>
      ) : (

        /* 2. GIAO DIỆN CHÍNH (Đã đăng nhập) */
        <div className="flex min-h-screen w-full">

          {/* SIDEBAR ĐIỀU HƯỚNG TRÁI */}
          <nav className="hidden lg:flex flex-col h-screen fixed left-0 top-0 w-[280px] bg-[#111827]/80 backdrop-blur-xl border-r border-white/10 py-8 z-50">
            <div className="px-6 mb-8 flex flex-col items-center">
              <div className="w-16 h-16 rounded-full mb-3 bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-xl font-black shadow-lg">
                {getAvatarText(userEmail)}
              </div>
              <h2 className="font-bold text-sm text-white text-center max-w-[240px] truncate px-2">{userEmail}</h2>
              <p className="text-[11px] text-slate-400 text-center mt-1 bg-white/5 px-3 py-0.5 rounded-full border border-white/5 font-mono">
                {role === 'TEACHER' ? `Giảng viên ${userId ? `(${userId})` : ''}` : `Sinh viên ${userId ? `(${userId})` : ''}`}
              </p>
            </div>

            <div className="flex-1 px-4 flex flex-col gap-1">
              <button
                onClick={() => setCurrentTab('dashboard')}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full text-left text-sm transition cursor-pointer ${currentTab === 'dashboard' ? 'text-emerald-400 font-bold bg-white/5 border-r-2 border-emerald-500' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                <LayoutDashboard size={18} /> Tổng quan
              </button>

              <button
                onClick={() => setCurrentTab('schedule')}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full text-left text-sm transition cursor-pointer ${currentTab === 'schedule' ? 'text-emerald-400 font-bold bg-white/5 border-r-2 border-emerald-500' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                <Calendar size={18} /> Lịch học lớp
              </button>

              <button
                onClick={() => setCurrentTab('reports')}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full text-left text-sm transition cursor-pointer ${currentTab === 'reports' ? 'text-emerald-400 font-bold bg-white/5 border-r-2 border-emerald-500' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                <BarChart3 size={18} /> Báo cáo điểm danh
              </button>

              <button
                onClick={() => setCurrentTab('settings')}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg w-full text-left text-sm transition cursor-pointer ${currentTab === 'settings' ? 'text-emerald-400 font-bold bg-white/5 border-r-2 border-emerald-500' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                <Settings size={18} /> Cài đặt thông tin
              </button>
            </div>

            <div className="px-4 mt-auto flex flex-col gap-1">
              <a className="flex items-center gap-3 px-4 py-3 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition text-sm" href="#help"><HelpCircle size={18} /> Trợ giúp</a>
              <button onClick={handleLogOut} className="flex items-center gap-3 px-4 py-3 rounded-lg text-rose-400 hover:bg-rose-500/10 transition text-left w-full cursor-pointer font-medium text-sm"><LogOut size={18} /> Đăng xuất</button>
            </div>
          </nav>

          {/* KHÔNG GIAN LÀM VIỆC CHÍNH BÊN PHẢI */}
          <div className="flex-1 ml-0 lg:ml-[280px] flex flex-col min-h-screen">

            {/* TOP BAR */}
            <header className="fixed top-0 right-0 w-full lg:w-[calc(100%-280px)] h-16 bg-[#0A0F1E]/60 backdrop-blur-md border-b border-white/10 z-40 flex items-center justify-between px-6 md:px-8">
              <span className="text-base font-black text-emerald-400 tracking-wider">AttendancePro</span>
              <div className="flex items-center gap-4">
                <button className="text-slate-400 hover:text-emerald-400 transition"><Search size={18} /></button>
                <div className="h-5 w-px bg-white/20 mx-1"></div>
                <button onClick={handleLogOut} className="text-xs font-semibold text-slate-200 hover:text-emerald-400 uppercase tracking-wider cursor-pointer transition">Đăng xuất</button>
              </div>
            </header>

            {/* VÙNG CHỨA NỘI DUNG CHÍNH */}
            <main className="flex-1 mt-16 p-4 md:p-8">

              {/* --- TAB 1: TỔNG QUAN (DASHBOARD) --- */}
              {currentTab === 'dashboard' && (
                role === 'TEACHER' ? (
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Cột trái: Khu vực quản lý và sinh mã QR */}
                    <section className="lg:col-span-8 flex flex-col items-center justify-center min-h-[460px] bg-[#111827]/40 rounded-2xl border border-white/5 p-6">
                      <div className="text-center mb-6">
                        <h2 className="text-lg font-bold text-white">Màn hình quản lý lớp học</h2>
                        <p className="text-xs text-slate-400 mt-1">Môn học: MẠNG MÁY TÍNH - NHÓM 01</p>
                      </div>

                      <div className="relative w-64 h-64 md:w-72 md:h-72 rounded-3xl bg-[#111827] flex flex-col items-center justify-center p-6 border border-white/10 shadow-2xl shadow-emerald-950/20">
                        <div className="w-full h-full bg-[#0A0F1E] rounded-2xl overflow-hidden relative border border-emerald-500/20 p-4 flex flex-col items-center justify-center text-center">

                          {teacherToken === 'CHƯA TẠO MÃ' ? (
                            <span className="font-mono text-xl font-bold text-slate-600">
                              {teacherToken}
                            </span>
                          ) : (
                            <div className="bg-white p-3 rounded-xl shadow-lg transition duration-300 transform scale-100">
                              <QRCodeCanvas
                                value={JSON.stringify({
                                  class_id: "SE330",
                                  token: teacherToken
                                })}
                                size={150}
                                bgColor="#ffffff"
                                fgColor="#000000"
                                level="H"
                              />

                            </div>
                          )}

                          <p className="text-[9px] text-slate-400 tracking-widest font-bold mt-4 border-t border-white/10 pt-2 w-full uppercase">
                            DYNAMIC CLOUD TOKEN: {teacherToken !== 'CHƯA TẠO MÃ' && <span className="text-emerald-400 font-mono">{teacherToken}</span>}
                          </p>

                          {teacherToken !== 'CHƯA TẠO MÃ' && (
                            <div className="absolute top-0 left-0 w-full h-[2px] bg-emerald-400 shadow-[0_0_10px_#10b981] animate-scan"></div>
                          )}
                        </div>

                        <div className="absolute -bottom-4 bg-[#1f2937] px-5 py-1.5 rounded-full border border-emerald-500/40 shadow-lg">
                          <span className="text-[11px] font-semibold text-emerald-400 tracking-wider font-mono">
                            {countdown > 0 ? `TỰ ĐỘNG XOAY VÒNG: ${countdown}S` : teacherToken === 'CHƯA TẠO MÃ' ? 'HỆ THỐNG SẴN SÀNG' : 'MÃ ĐÃ HẾT HẠN'}
                          </span>
                        </div>
                      </div>

                      <div className="mt-10 flex flex-col items-center gap-3">
                        <button 
                          onClick={handleCreateClassQR} 
                          disabled={loading} 
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-6 py-2.5 rounded-full shadow-lg shadow-emerald-900/30 transition duration-200 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {buttonState}
                        </button>
                        {gpsStatus && (
                          <p className={`text-xs font-semibold ${
                            gpsStatus === 'GPS sẵn sàng.' 
                              ? 'text-emerald-400' 
                              : gpsStatus === 'Đang lấy vị trí GPS...' 
                                ? 'text-amber-400 animate-pulse' 
                                : 'text-rose-400'
                          }`}>
                            {gpsStatus}
                          </p>
                        )}
                        {status.type === 'error' && role === 'TEACHER' && (
                          <div className="bg-rose-500/5 rounded-xl p-3 border border-rose-500/20 text-rose-400 text-xs flex gap-2 items-center justify-center max-w-xs mt-2">
                            <AlertCircle size={16} className="flex-shrink-0" />
                            <p className="font-medium">{status.message}</p>
                          </div>
                        )}
                      </div>
                    </section>

                    {/* Cột phải: Feed nhận diện thời gian thực */}
                    <section className="lg:col-span-4 flex flex-col">
                      <div className="bg-[#111827]/60 rounded-2xl border border-white/10 overflow-hidden min-h-[460px] flex flex-col">
                        <div className="px-5 py-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                          <h3 className="font-bold text-xs tracking-wide text-white uppercase flex items-center gap-2">
                            <span className={`inline-block w-2 w-2 h-2 rounded-full ${teacherToken !== 'CHƯA TẠO MÃ' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`}></span>
                            Sinh viên vừa quét mã
                          </h3>
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md font-bold">{attendanceList.length} Lớp</span>
                        </div>

                        <div className="p-4 flex-1 flex flex-col gap-2.5 overflow-y-auto">
                          {attendanceList.length === 0 ? (
                            <div className="my-auto text-center py-8">
                              <p className="text-xs text-slate-500 italic">Chưa có dữ liệu điểm danh.</p>
                            </div>
                          ) : (
                            attendanceList.map((student, idx) => (
                              <div key={idx} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/5 text-xs hover:border-white/10 transition">
                                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold">
                                  {student.name.substring(0, 1)}
                                </div>
                                <div className="flex-1">
                                  <h4 className="font-semibold text-white">{student.name}</h4>
                                  <p className="text-slate-400 flex items-center gap-1 mt-0.5 text-[11px]"><CheckCircle2 size={12} className="text-emerald-400" /> Đã xác thực GPS</p>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono">{student.time}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </section>
                  </div>
                ) : (
                  <div className="flex flex-col lg:flex-row gap-6 items-stretch justify-center max-w-5xl mx-auto min-h-[calc(100vh-140px)]">
                    {/* Cột trái: Khung ngắm Camera Web */}
                    <div className="flex-1 bg-[#111827]/40 border border-white/5 p-6 rounded-2xl flex flex-col items-center justify-center">
                      <div className="relative w-full max-w-md aspect-square bg-[#0D1527] rounded-2xl overflow-hidden flex items-center justify-center border border-white/10 shadow-2xl">
                        <div
                          id="reader-viewport"
                          className="w-full h-full object-cover rounded-xl overflow-hidden"
                        ></div>

                        {!scanResult && (
                          <div className="absolute inset-0 pointer-events-none z-10">
                            <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-emerald-400"></div>
                            <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-emerald-400"></div>
                            <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-emerald-400"></div>
                            <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-emerald-400"></div>
                            <div className="absolute w-full h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent top-0 animate-scan"></div>
                          </div>
                        )}

                        <div className="absolute top-4 left-4 z-20 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full flex items-center gap-2 border border-white/10">
                          <div className={`w-1.5 h-1.5 rounded-full ${!scanResult ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`}></div>
                          <span className="text-[9px] font-bold tracking-wider text-white font-mono">{!scanResult ? 'LIVE CAMERA' : 'PAUSED'}</span>
                        </div>
                      </div>

                      <div className="mt-4 text-center">
                        <h2 className="text-base font-bold text-white">Căn chỉnh mã QR vào giữa khung hình</h2>
                        <p className="text-xs text-slate-400 mt-1">Hệ thống nhận dạng luồng quét lớp học tự động</p>
                      </div>
                    </div>

                    {/* Cột phải: Metadata và Trạng thái Cloud */}
                    <div className="w-full lg:w-80 flex flex-col gap-4 justify-center">
                      <div className="bg-[#111827] rounded-xl p-4 border border-white/10 shadow-lg">
                        <div className="flex items-center justify-between mb-2">
                          <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-400">
                            <GraduationCap size={18} />
                          </div>
                          <span className="bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full text-[9px] font-bold text-emerald-400 tracking-wide uppercase">ĐANG DIỄN RA</span>
                        </div>
                        <h3 className="text-sm font-bold text-white">Mạng máy tính học phần</h3>
                        <p className="text-xs text-slate-400 mt-0.5">Mã lớp: MANG_MAY_TINH_01</p>
                      </div>

                      <div className="bg-[#111827] rounded-xl p-4 flex items-center gap-3 border border-white/5">
                        <div className="w-9 h-9 rounded-full bg-white/5 flex items-center justify-center text-emerald-400 flex-shrink-0">
                          <Compass size={18} className={!location.lat ? "animate-spin" : ""} />
                        </div>
                        <div className="overflow-hidden">
                          <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase block">XÁC THỰC GPS VỆ TINH</span>
                          <p className="text-xs font-bold text-white mt-0.5 font-mono truncate">
                            {location.lat ? `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}` : "Đang tính toán tọa độ..."}
                          </p>
                        </div>
                      </div>

                      {scanResult && (
                        <div className="bg-emerald-500/5 rounded-xl p-4 border border-emerald-500/20 shadow-md">
                          <div className="flex gap-3 items-start">
                            <CheckCircle2 size={20} className="text-emerald-400 flex-shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <h5 className="text-xs font-bold text-white mb-0.5">Mã Token hợp lệ</h5>
                              <p className="text-[11px] text-slate-400 leading-normal break-all">
                                Mã nhận diện: <span className="font-mono text-emerald-400 font-bold">{scanResult}</span>. Đang truyền dữ liệu lên AWS Cloud xác thực vị trí...
                              </p>
                              <button onClick={() => setScanResult('')} className="mt-3 text-[11px] text-emerald-400 underline hover:text-white transition block cursor-pointer">
                                Tiếp tục quét lại
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                      {status.type === 'success' && (
                        <div className="bg-emerald-500/5 rounded-xl p-4 border border-emerald-500/20 text-emerald-400 text-xs flex gap-2 items-center">
                          <CheckCircle2 size={16} className="flex-shrink-0" />
                          <p className="font-medium">{status.message}</p>
                        </div>
                      )}
                      {status.type === 'error' && (
                        <div className="bg-rose-500/5 rounded-xl p-4 border border-rose-500/20 text-rose-400 text-xs flex gap-2 items-center">
                          <AlertCircle size={16} className="flex-shrink-0" />
                          <p className="font-medium">{status.message}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              )}

              {/* --- TAB 2: LỊCH HỌC LỚP --- */}
              {currentTab === 'schedule' && (
                <div className="space-y-6 max-w-5xl mx-auto">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Calendar className="text-emerald-400" size={24} /> Lịch học lớp cá nhân
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">Danh sách phân ca và lịch giảng dạy/học tập chi tiết trong tuần.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-[#111827]/60 border border-white/10 rounded-2xl p-5 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-bold font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">THỨ BA - CA 1</span>
                          <span className="text-xs font-medium text-slate-400 flex items-center gap-1"><Clock size={14} /> 07:00 - 09:30</span>
                        </div>
                        <h3 className="text-base font-bold text-white">Mạng máy tính (Học phần 1)</h3>
                        <p className="text-xs text-slate-400 mt-1 font-mono">Mã lớp: MANG_MAY_TINH_01</p>
                      </div>
                      <div className="mt-6 pt-3 border-t border-white/5 flex items-center gap-2 text-xs text-slate-400">
                        <MapPin size={14} className="text-emerald-400" /> Phòng máy 302 - Tòa nhà C
                      </div>
                    </div>

                    <div className="bg-[#111827]/60 border border-white/5 rounded-2xl p-5 opacity-60 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-[10px] font-bold font-mono text-slate-400 bg-white/5 border border-white/5 px-2.5 py-1 rounded-md">THỨ NĂM - CA 2</span>
                          <span className="text-xs font-medium text-slate-400 flex items-center gap-1"><Clock size={14} /> 09:45 - 12:15</span>
                        </div>
                        <h3 className="text-base font-bold text-white">An toàn bảo mật thông tin</h3>
                        <p className="text-xs text-slate-400 mt-1 font-mono">Mã lớp: ATBM_02</p>
                      </div>
                      <div className="mt-6 pt-3 border-t border-white/5 flex items-center gap-2 text-xs text-slate-400">
                        <MapPin size={14} /> Phòng lý thuyết 405 - Tòa nhà A
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* --- TAB 3: BÁO CÁO ĐIỂM DANH --- */}
              {currentTab === 'reports' && (
                <div className="space-y-6 max-w-5xl mx-auto">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <BarChart3 className="text-emerald-400" size={24} /> Báo cáo & Thống kê dữ liệu
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">Phân tích tỷ lệ đi học chuyên cần và lịch sử ghi nhận điểm danh.</p>
                  </div>

                  <div className="bg-[#111827]/60 border border-white/10 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/10 bg-white/5">
                      <h3 className="text-xs font-bold tracking-wide text-white uppercase">Nhật ký điểm danh chi tiết</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 text-slate-400 font-semibold bg-[#0A0F1E]/30">
                            <th className="p-4">Tên Học Phần / Sinh Viên</th>
                            <th className="p-4">Mã Số</th>
                            <th className="p-4">Thời Gian Nhận Diện</th>
                            <th className="p-4 text-right">Trạng Thái Cloud</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-300">
                          {role === 'TEACHER' ? (
                            attendanceList.map((st, i) => (
                              <tr key={i} className="hover:bg-white/5 transition">
                                <td className="p-4 font-medium text-white">{st.name}</td>
                                <td className="p-4 font-mono text-slate-400">{st.id}</td>
                                <td className="p-4 font-mono">{st.time}</td>
                                <td className="p-4 text-right"><span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium text-[11px]">{st.status}</span></td>
                              </tr>
                            ))
                          ) : (
                            <tr className="hover:bg-white/5 transition">
                              <td className="p-4 font-medium text-white">Mạng máy tính (Nhóm 01)</td>
                              <td className="p-4 font-mono text-slate-400">MANG_MAY_TINH_01</td>
                              <td className="p-4 font-mono">{scanResult ? '07:34' : '--:--'}</td>
                              <td className="p-4 text-right">
                                <span className={`px-2 py-0.5 rounded-full font-medium text-[11px] ${scanResult ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                                  {scanResult ? 'Đã điểm danh' : 'Vắng / Chưa quét'}
                                </span>
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* --- TAB 4: CÀI ĐẶT THÔNG TIN --- */}
              {currentTab === 'settings' && (
                <div className="space-y-6 max-w-3xl mx-auto">
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <Settings className="text-emerald-400" size={24} /> Cấu hình tài khoản & Hệ thống
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">Quản lý bảo mật thông tin và tùy chỉnh bán kính quét định vị GPS phòng học.</p>
                  </div>

                  <div className="bg-[#111827]/60 border border-white/10 rounded-2xl p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email phân quyền</label>
                        <input type="text" disabled value={userEmail} className="w-full bg-[#0A0F1E] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-slate-400 font-medium font-mono" />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Vai trò hệ thống</label>
                        <input type="text" disabled value={role === 'TEACHER' ? 'GIẢNG VIÊN (AWS ADMIN)' : 'SINH VIÊN'} className="w-full bg-[#0A0F1E] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-emerald-400 font-bold font-mono" />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/5">
                      <h3 className="text-sm font-bold text-white mb-3">Tham số Cloud Geofencing</h3>
                      <div className="p-4 bg-[#0A0F1E] rounded-xl border border-white/5 flex items-start gap-3">
                        <UserCheck className="text-emerald-400 mt-0.5 flex-shrink-0" size={18} />
                        <div>
                          <h4 className="text-xs font-bold text-white">Sai số GPS cho phép: 25 mét</h4>
                          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">Hệ thống áp dụng giải thuật Haversine để tự động kiểm thử khoảng cách sai lệch giữa tọa độ thực tế từ thiết bị của sinh viên và tọa độ gốc được khai báo trên giảng đường.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

            </main>
          </div>
        </div>
      )}
    </div>
  );
}