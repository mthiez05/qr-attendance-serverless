import React, { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { LogIn, User, GraduationCap, LogOut, LayoutDashboard, Calendar, BarChart3, Settings, HelpCircle, Search, CheckCircle2, AlertCircle, Compass, Clock, MapPin, UserCheck, ShieldAlert } from 'lucide-react';
// 👉 ĐÃ THÊM: Import thư viện tạo mã QR thực tế
import { QRCodeCanvas } from 'qrcode.react';
import * as XLSX from 'xlsx';
import RobotoRegular from './assets/fonts/Roboto-Regular.ttf?url';
import RobotoBold from './assets/fonts/Roboto-Bold.ttf?url';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
const API_BASE = import.meta.env.VITE_API_BASE;
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
  const [buttonState, setButtonState] = useState('Tạo QR');
  const [schedules, setSchedules] = useState([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [studentSchedules, setStudentSchedules] = useState([]);
  const [selectedReportClass, setSelectedReportClass] = useState("ALL");
  const [searchStudent, setSearchStudent] = useState('');

  // Danh sách sinh viên thực tế (Bắt đầu bằng mảng rỗng)
  const [attendanceList, setAttendanceList] = useState([]);
  const [studentAttendance, setStudentAttendance] = useState([]);
  const fetchStudentAttendance = async (studentId) => {
    try {
      const response = await fetch(
        `${API_BASE}/student/attendance?student_id=${studentId}`
      );

      const data = await response.json();

      if (response.ok) {

        const mappedData = data.map(item => ({
          class_id: item.class_id || "",
          id: item.student_id || "",
          name: item.full_name || item.student_id,
          time: new Date(item.timestamp).toLocaleString(
            "vi-VN",
            {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit"
            }
          ),
          status:
            item.status === "PRESENT"
              ? "Hợp lệ"
              : item.status
        }));

        setStudentAttendance(mappedData);

      } else {
        setStudentAttendance([]);
      }

    } catch (error) {
      console.error(error);
      setStudentAttendance([]);
    }
  };
  // Hàm gọi API lấy danh sách điểm danh thực tế của giảng viên
  const fetchAttendance = async (teacherId) => {
    try {
      const response = await fetch(`${API_BASE}/teacher/attendance?teacher_id=${teacherId}`);
      const data = await response.json();
      if (response.ok) {
        // Ánh xạ các trường dữ liệu từ backend tương thích với hiển thị của frontend
        const mappedData = data.map(item => ({
          class_id: item.class_id || "Không rõ",
          id: item.student_id || item.id || "",
          name: item.full_name || item.name || item.student_id || "",
          student_name: item.full_name || item.name || "",
          time: item.timestamp
            ? new Date(item.timestamp).toLocaleString("vi-VN", {
              year: "numeric",
              month: "2-digit",
              day: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit"
            })
            : (item.time || ""),

          status: item.status === "PRESENT"
            ? "Hợp lệ"
            : (item.status || "Hợp lệ"),

          // thêm thống kê lớp
          total_students: item.total_students || 0,
          attendance_count: item.attendance_count || 0,
          attendance_rate: item.attendance_rate || "0/0",
          attendance_percent: item.attendance_percent || 0
        }));
        setAttendanceList(mappedData);
      } else {
        console.error("Lỗi lấy dữ liệu điểm danh:", data.message);
        setAttendanceList([]);
      }
    } catch (err) {
      console.error("Lỗi kết nối API điểm danh:", err);
      setAttendanceList([]);
    }
  };

  // Hàm chuyển đổi ngày tiếng Anh sang tiếng Việt
  const getDayVietnamese = (dayStr) => {
    if (!dayStr) return '';
    const lower = dayStr.toLowerCase().trim();
    if (lower === 'monday' || lower === 'thứ hai' || lower === 'thu hai') return 'Thứ Hai';
    if (lower === 'tuesday' || lower === 'thứ ba' || lower === 'thu ba') return 'Thứ Ba';
    if (lower === 'wednesday' || lower === 'thứ tư' || lower === 'thu tu') return 'Thứ Tư';
    if (lower === 'thursday' || lower === 'thứ năm' || lower === 'thu nam') return 'Thứ Năm';
    if (lower === 'friday' || lower === 'thứ sáu' || lower === 'thu sau') return 'Thứ Sáu';
    if (lower === 'saturday' || lower === 'thứ bảy' || lower === 'thu bay') return 'Thứ Bảy';
    if (lower === 'sunday' || lower === 'chủ nhật' || lower === 'chu nhat') return 'Chủ Nhật';
    return dayStr;
  };

  // Hàm gọi API lấy danh sách lịch dạy của giảng viên
  const fetchSchedules = async (teacherId) => {
    try {
      const response = await fetch(`${API_BASE}/teacher/schedules?teacher_id=${teacherId}`);
      const data = await response.json();
      if (response.ok) {
        setSchedules(data);
      } else {
        console.error("Lỗi lấy lịch dạy:", data.message);
        setSchedules([]);
      }
    } catch (err) {
      console.error("Lỗi kết nối API lịch dạy:", err);
      setSchedules([]);
    }
  };

  const fetchStudentSchedules = async (studentId) => {
    try {
      const response = await fetch(
        `${API_BASE}/student/schedules?student_id=${studentId}`
      );

      const data = await response.json();

      if (response.ok) {
        setStudentSchedules(data);
      } else {
        setStudentSchedules([]);
      }

    } catch (error) {
      console.error(
        "Lỗi lấy lịch sinh viên:",
        error
      );

      setStudentSchedules([]);
    }
  };
  // Restore session from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      try {
        const user = JSON.parse(storedUser);
        if (user && user.user_id) {
          setUserId(user.user_id);
          setUserEmail(user.email);
          if (user.role === 'teacher') {
            setRole('TEACHER');
            fetchAttendance(user.user_id);
            fetchSchedules(user.user_id);

          } else if (user.role === 'student') {
            setRole('STUDENT');
            fetchStudentSchedules(user.user_id);
            fetchStudentAttendance(user.user_id);
          } else {
            setRole((user.role || '').toUpperCase());
          }
          setIsLoggedIn(true);
        }
      } catch (err) {
        console.error("Error loading session:", err);
      }
    }
  }, []);

  // Xử lý Đăng nhập
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!inputEmail || !inputPassword) {
      alert('Vui lòng nhập đầy đủ thông tin!');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: inputEmail,
          password: inputPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.message || 'Đăng nhập thất bại!');
        return;
      }

      // Store in localStorage
      localStorage.setItem('currentUser', JSON.stringify({
        user_id: data.user_id,
        full_name: data.full_name,
        email: data.email,
        role: data.role
      }));

      // Update state
      setUserId(data.user_id);
      setUserEmail(data.email);

      // Navigate based on role
      if (data.role === 'teacher') {
        setRole('TEACHER');
        fetchAttendance(data.user_id);
        fetchSchedules(data.user_id);
      } else if (data.role === 'student') {
        setRole('STUDENT');
        fetchStudentSchedules(data.user_id);
        fetchStudentAttendance(data.user_id);
      } else {
        setRole((data.role || '').toUpperCase());
      }
      setIsLoggedIn(true);
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối đến máy chủ đăng nhập!');
    } finally {
      setLoading(false);
    }
  };

  const handleLogOut = () => {
    localStorage.removeItem('currentUser');
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
    setButtonState('Tạo QR');
    setSchedules([]);
    setSelectedScheduleId('');
    setCurrentTab('dashboard');
  };

  // Vị trí GPS Sinh viên & Giảng viên
  useEffect(() => {
    if (
      isLoggedIn &&
      (role === "STUDENT" || role === "TEACHER") &&
      currentTab === "dashboard" &&
      navigator.geolocation
    ) {
      console.log("Đang lấy GPS...");
      if (role === "TEACHER") {
        setGpsStatus("Đang lấy vị trí GPS...");
      }

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

          if (role === "TEACHER") {
            setGpsStatus("GPS sẵn sàng.");
          }
        },
        (error) => {
          console.log("GPS ERROR");
          console.log(error);

          setStatus({
            type: "error",
            message: "Vui lòng bật quyền truy cập GPS trên thiết bị!",
          });

          if (role === "TEACHER") {
            setGpsStatus("GPS lỗi hoặc bị từ chối!");
          }
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

        await fetchStudentAttendance(userId);
        console.log("Student attendance:", data);
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
    if (!selectedScheduleId) {
      setStatus({
        type: "error",
        message: "Vui lòng chọn lịch dạy."
      });
      return;
    }

    try {
      setLoading(true);
      setStatus({ type: '', message: '' });
      setButtonState('Đang tạo QR...');

      const response = await fetch(
        `${API_BASE}/teacher/create-class`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            teacher_id: userId,
            schedule_id: selectedScheduleId,
            latitude: location.lat,
            longitude: location.lon
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
      setStatus({
        type: "error",
        message: "Lỗi xử lý: " + (error.message || "Không tạo được QR")
      });
    } finally {
      setLoading(false);
      setButtonState('Tạo QR');
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

  // Logic lọc danh sách điểm danh kết hợp mã lớp và từ khóa tìm kiếm sinh viên
  const filteredAttendance = attendanceList.filter(student => {
    const matchClass =
      selectedReportClass === "ALL" ||
      student.class_id === selectedReportClass;

    const keyword = searchStudent.toLowerCase().trim();

    const matchStudent =
      (student.name || "").toLowerCase().includes(keyword) ||
      (student.id || "").toLowerCase().includes(keyword);

    return matchClass && matchStudent;
  });

  // Hàm chuyển đổi tiếng Việt có dấu sang không dấu để xuất PDF không bị lỗi font
  const removeVietnameseAccents = (str) => {
    if (!str) return "";
    return str
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "D");
  };

  // Hàm xuất báo cáo Excel (.xlsx)
  const exportExcel = () => {
    if (filteredAttendance.length === 0) {
      alert("Không có dữ liệu để xuất!");
      return;
    }
    try {
      const dataToExport = filteredAttendance.map(student => ({
        "Mã lớp": student.class_id || "",
        "MSSV": student.id || "",
        "Họ tên sinh viên": student.name || "",
        "Thời gian nhận diện": student.time || "",
        "Trạng thái": student.status || ""
      }));

      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "DiemDanh");
      XLSX.writeFile(workbook, "bao_cao_diem_danh.xlsx");
    } catch (error) {
      console.error("Lỗi khi xuất file Excel:", error);
      alert("Lỗi khi xuất file Excel!");
    }
  };
  // Hàm hỗ trợ chuyển URL font sang Base64 cho jsPDF
  const fetchFontAsBase64 = async (fontUrl) => {
    const response = await fetch(fontUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64data = reader.result.split(',')[1];
        resolve(base64data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };
  // Hàm xuất báo cáo PDF (.pdf)
  // Hàm xuất báo cáo PDF (.pdf) - Giữ tiếng Việt có dấu
  const exportPDF = async () => {
    if (filteredAttendance.length === 0) {
      alert("Không có dữ liệu để xuất!");
      return;
    }
    try {
      const doc = new jsPDF();

      // 1. Chuyển đổi font Regular sang Base64 và nạp vào VFS
      const fontRegularBase64 = await fetchFontAsBase64(RobotoRegular);
      doc.addFileToVFS("Roboto-Regular.ttf", fontRegularBase64);
      doc.addFont("Roboto-Regular.ttf", "Roboto", "normal");

      // 2. Chuyển đổi font Bold sang Base64 và nạp vào VFS
      if (RobotoBold) {
        const fontBoldBase64 = await fetchFontAsBase64(RobotoBold);
        doc.addFileToVFS("Roboto-Bold.ttf", fontBoldBase64);
        doc.addFont("Roboto-Bold.ttf", "Roboto", "bold");
      }

      // Tiêu đề PDF
      doc.setFont("Roboto", "bold");
      doc.setFontSize(16);
      doc.text("Báo cáo điểm danh", 14, 20);

      // Hiển thị mã lớp nếu có chọn lọc
      if (selectedReportClass !== "ALL") {
        doc.setFontSize(11);
        doc.setFont("Roboto", "normal");
        doc.text(`Mã lớp: ${selectedReportClass}`, 14, 28);
      }

      const headers = [
        "Mã lớp",
        "MSSV",
        "Họ tên",
        "Thời gian nhận diện",
        "Trạng thái"
      ];

      const rows = filteredAttendance.map(student => [
        student.class_id || "",
        student.id || "",
        student.name || "",
        student.time || "",
        student.status || ""
      ]);

      // Xuất bảng dữ liệu
      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: selectedReportClass !== "ALL" ? 34 : 26,
        theme: "striped",
        headStyles: { fillColor: [16, 185, 129] },
        styles: { font: "Roboto", fontStyle: "normal", fontSize: 10 }
      });

      doc.save("bao_cao_diem_danh.pdf");
    } catch (error) {
      console.error("Lỗi khi xuất file PDF:", error);
      alert("Lỗi khi xuất file PDF: " + error.message);
    }
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
                        <p className="text-xs text-slate-400 mt-1">
                          {(() => {
                            const selectedSchedule = schedules.find(s => s.schedule_id === selectedScheduleId);
                            return selectedSchedule
                              ? `Môn học: ${selectedSchedule.course_name.toUpperCase()} - NHÓM ${selectedSchedule.class_id}`
                              : 'Vui lòng chọn môn học';
                          })()}
                        </p>
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
                                  class_id: (() => {
                                    const selectedSchedule = schedules.find(s => s.schedule_id === selectedScheduleId);
                                    return selectedSchedule ? selectedSchedule.class_id : "";
                                  })(),
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

                      <div className="mt-10 flex flex-col items-center gap-3 w-full">
                        {/* Dropdown chọn lịch dạy */}
                        <div className="w-full max-w-xs mb-2">
                          <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2 text-center">
                            Chọn lịch dạy
                          </label>
                          <select
                            value={selectedScheduleId}
                            onChange={(e) => setSelectedScheduleId(e.target.value)}
                            disabled={loading || teacherToken !== 'CHƯA TẠO MÃ'}
                            className="w-full bg-[#0A0F1E] border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500 font-medium transition cursor-pointer"
                          >
                            <option value="">-- Chọn lịch dạy --</option>
                            {schedules.map((schedule) => {
                              const dayVietnamese = getDayVietnamese(schedule.day);
                              return (
                                <option key={schedule.schedule_id} value={schedule.schedule_id}>
                                  {schedule.course_name} | {schedule.class_id} - {dayVietnamese} | {schedule.start_time} - {schedule.end_time}
                                </option>
                              );
                            })}
                          </select>
                        </div>

                        <button
                          onClick={handleCreateClassQR}
                          disabled={loading || !selectedScheduleId}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-sm px-6 py-2.5 rounded-full shadow-lg shadow-emerald-900/30 transition duration-200 active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {buttonState}
                        </button>
                        {gpsStatus && (
                          <p className={`text-xs font-semibold ${gpsStatus === 'GPS sẵn sàng.'
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
                          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-md font-bold">{attendanceList.length} Lượt điểm danh</span>
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
                      <Calendar className="text-emerald-400" size={24} />
                      {role === 'TEACHER' ? 'Lịch giảng dạy' : 'Lịch học cá nhân'}

                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      {role === 'TEACHER'
                        ? 'Danh sách các lớp và lịch giảng dạy được phân công trong tuần.'
                        : 'Danh sách các môn học và lịch học trong tuần.'}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                    {(role === 'TEACHER' ? schedules : studentSchedules).length === 0 ? (

                      <div className="text-slate-400 text-sm">
                        Không có lịch giảng dạy.
                      </div>

                    ) : (

                      (role === 'TEACHER' ? schedules : studentSchedules).map((schedule) => (

                        <div
                          key={schedule.schedule_id}
                          className="bg-[#111827]/60 border border-white/10 rounded-2xl p-5 flex flex-col justify-between"
                        >

                          <div>

                            <div className="flex items-center justify-between mb-3">

                              <span className="text-[10px] font-bold font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md">
                                {getDayVietnamese(schedule.day)}
                              </span>


                              <span className="text-xs font-medium text-slate-400 flex items-center gap-1">
                                <Clock size={14} />
                                {schedule.start_time} - {schedule.end_time}
                              </span>

                            </div>


                            <h3 className="text-base font-bold text-white">
                              {schedule.course_name}
                            </h3>


                            <p className="text-xs text-slate-400 mt-1 font-mono">
                              Mã lớp: {schedule.class_id}
                            </p>


                            <p className="text-xs text-slate-500 mt-1 font-mono">
                              Mã học phần: {schedule.course_id}
                            </p>

                          </div>


                          <div className="mt-6 pt-3 border-t border-white/5 flex items-center gap-2 text-xs text-slate-400">

                            <MapPin size={14} className="text-emerald-400" />

                            Phòng {schedule.room}

                          </div>


                        </div>

                      ))

                    )}

                  </div>
                </div>
              )}

              {/* --- TAB 3: BÁO CÁO ĐIỂM DANH --- */}
              {currentTab === 'reports' && (
                <div className="space-y-6 max-w-5xl mx-auto">
                  {/* Bộ lọc báo cáo theo mã lớp & Tìm kiếm sinh viên */}
                  {role === "TEACHER" && (
                    <div className="bg-[#111827]/60 border border-white/10 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-end">
                      <div className="w-full md:w-auto flex-1">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                          Lọc theo mã lớp
                        </label>

                        <select
                          value={selectedReportClass}
                          onChange={(e) => setSelectedReportClass(e.target.value)}
                          className="bg-[#0A0F1E] border border-white/10 rounded-xl px-4 py-2 text-sm text-white w-full max-w-xs cursor-pointer focus:outline-none focus:border-emerald-500 transition"
                        >
                          <option value="ALL">
                            Tất cả lớp
                          </option>

                          {
                            [...new Set(attendanceList.map(item => item.class_id))]
                              .map(classId => (
                                <option key={classId} value={classId}>
                                  {classId}
                                </option>
                              ))
                          }

                        </select>
                      </div>

                      <div className="w-full md:w-auto flex-1 relative">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">
                          Tìm kiếm sinh viên
                        </label>
                        <div className="relative">
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                            <Search size={16} className="text-slate-400" />
                          </span>
                          <input
                            type="text"
                            placeholder="Nhập họ tên hoặc MSSV..."
                            value={searchStudent}
                            onChange={(e) => setSearchStudent(e.target.value)}
                            className="w-full bg-[#0A0F1E] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-emerald-500 font-medium transition"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                  <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                      <BarChart3 className="text-emerald-400" size={24} /> Báo cáo & Thống kê dữ liệu
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">Phân tích tỷ lệ đi học chuyên cần và lịch sử ghi nhận điểm danh.</p>
                  </div>
                  {
                    selectedReportClass !== "ALL" && (() => {

                      const classData = attendanceList.find(
                        item => item.class_id === selectedReportClass
                      );

                      if (!classData) return null;

                      return (
                        <div className="mt-4 grid grid-cols-3 gap-3">

                          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                            <p className="text-[10px] text-slate-400 uppercase">
                              Tổng sinh viên
                            </p>

                            <p className="text-xl font-bold text-white">
                              {classData.total_students}
                            </p>
                          </div>


                          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                            <p className="text-[10px] text-slate-400 uppercase">
                              Đã điểm danh
                            </p>

                            <p className="text-xl font-bold text-emerald-400">
                              {classData.attendance_count}
                            </p>
                          </div>


                          <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                            <p className="text-[10px] text-slate-400 uppercase">
                              Tỷ lệ
                            </p>

                            <p className="text-xl font-bold text-cyan-400">
                              {classData.attendance_rate}
                            </p>
                          </div>

                        </div>
                      );

                    })()
                  }
                  <div className="bg-[#111827]/60 border border-white/10 rounded-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/10 bg-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <h3 className="text-xs font-bold tracking-wide text-white uppercase">
                        {
                          role === "TEACHER"
                            ? "Nhật ký điểm danh lớp"
                            : "Lịch sử điểm danh cá nhân"
                        }
                      </h3>
                      {role === "TEACHER" && (
                        <div className="flex gap-2">
                          <button
                            onClick={exportExcel}
                            className="bg-[#0A0F1E] text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:border-emerald-500/50 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                          >
                            Xuất Excel
                          </button>
                          <button
                            onClick={exportPDF}
                            className="bg-[#0A0F1E] text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 hover:border-cyan-500/50 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition cursor-pointer flex items-center gap-1.5 active:scale-95"
                          >
                            Xuất PDF
                          </button>
                        </div>
                      )}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-white/5 text-slate-400 font-semibold bg-[#0A0F1E]/30">
                            <th className="p-4">Mã lớp</th>
                            <th className="p-4">Họ và tên sinh Viên</th>
                            <th className="p-4">MSSV</th>
                            <th className="p-4">Thời Gian Nhận Diện</th>
                            <th className="p-4 text-right">Trạng Thái Cloud</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-slate-300">
                          {
                            (
                              role === "TEACHER"
                                ?
                                filteredAttendance
                                :
                                studentAttendance
                            ).map((st, i) => (
                              <tr key={i} className="hover:bg-white/5 transition">

                                <td className="p-4 font-mono text-white">
                                  {st.class_id}
                                </td>

                                <td className="p-4 font-medium text-white">
                                  {st.name}
                                </td>

                                <td className="p-4 font-mono text-slate-400">
                                  {st.id}
                                </td>

                                <td className="p-4 font-mono">
                                  {st.time}
                                </td>

                                <td className="p-4 text-right">
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium text-[11px]">
                                    {st.status}
                                  </span>
                                </td>

                              </tr>
                            ))
                          }
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
                          <h4 className="text-xs font-bold text-white">Sai số GPS cho phép: 50 mét</h4>
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