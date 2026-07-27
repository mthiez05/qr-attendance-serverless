const { DynamoDBClient, ScanCommand, GetItemCommand } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: "ap-southeast-1" });

// Hàm định dạng thời gian sang múi giờ Việt Nam (GMT+7)
function formatTimeVietnam(timestamp) {
    if (!timestamp) return "";
    try {
        const date = new Date(timestamp);
        return date.toLocaleTimeString("en-US", {
            timeZone: "Asia/Ho_Chi_Minh",
            hour12: false,
            hour: "2-digit",
            minute: "2-digit"
        });
    } catch (e) {
        console.error("Lỗi định dạng thời gian:", e);
        return "";
    }
}

exports.handler = async (event) => {
    const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json; charset=utf-8"
};

    try {
        // 1. Kiểm tra tham số teacher_id từ query parameters
        const queryParams = event.queryStringParameters || {};
        const teacherId = queryParams.teacher_id;

        if (!teacherId || teacherId.trim() === "") {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ message: "Missing or invalid teacher_id parameter" })
            };
        }

        // 2. Scan bảng QR_Attendance_Schedules để lấy các class_id của giảng viên này
        const scanSchedulesCommand = new ScanCommand({
            TableName: "QR_Attendance_Schedules",
            FilterExpression: "teacher_id = :teacher_id",
            ExpressionAttributeValues: {
                ":teacher_id": { S: teacherId }
            }
        });

        const schedulesData = await client.send(scanSchedulesCommand);
        const schedules = schedulesData.Items || [];
        const classIds = schedules.map(item => item.class_id?.S).filter(Boolean);


        // Nếu giảng viên không dạy lớp học nào, trả về mảng rỗng ngay lập tức
        if (classIds.length === 0) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify([])
            };
        }

        // 3. Scan bảng QR_Attendance_Logs lấy logs của các lớp học này (sử dụng FilterExpression động)
        const expressionAttributeValues = {};
        const filterConditions = [];
        classIds.forEach((classId, idx) => {
            expressionAttributeValues[`:class${idx}`] = { S: classId };
            filterConditions.push(`class_id = :class${idx}`);
        });

        const scanLogsCommand = new ScanCommand({
            TableName: "QR_Attendance_Logs",
            FilterExpression: filterConditions.join(" OR "),
            ExpressionAttributeValues: expressionAttributeValues
        });

        const logsData = await client.send(scanLogsCommand);
        const logs = logsData.Items || [];
        // Lấy toàn bộ danh sách đăng ký lớp
const enrollmentsData = await client.send(
    new ScanCommand({
        TableName: "QR_Attendance_Enrollments"
    })
);

const enrollments = enrollmentsData.Items || [];
       

        // 4. Gom danh sách student_id không trùng lặp
        const studentIds = [...new Set(logs.map(log => log.student_id?.S).filter(Boolean))];

        // 5. Truy vấn thông tin người dùng từ bảng QR_Attendance_Users song song
        const userMap = {};
        await Promise.all(studentIds.map(async (studentId) => {
            try {
                const getUserCommand = new GetItemCommand({
                    TableName: "QR_Attendance_Users",
                    Key: { user_id: { S: studentId } }
                });
                const userData = await client.send(getUserCommand);
                if (userData.Item && userData.Item.full_name) {
                    userMap[studentId] = userData.Item.full_name.S;
                } else {
                    userMap[studentId] = studentId;
                }
            } catch (err) {
                console.error(`Lỗi khi lấy thông tin student_id ${studentId}:`, err);
                userMap[studentId] = studentId;
            }
        }));
        // ================================
// Thống kê theo từng lớp
// ================================
// ================================
// Thống kê theo từng lớp
// ================================
const classStatistics = {};

classIds.forEach(classId => {

    // Tổng sinh viên đăng ký lớp
    const enrolledStudents = new Set();

    enrollments.forEach(e => {
        if (
            e.class_id?.S === classId &&
            e.student_id?.S
        ) {
            enrolledStudents.add(e.student_id.S);
        }
    });


    // Sinh viên đã điểm danh
    const attendedStudents = new Set();

    logs.forEach(log => {
        if (
            log.class_id?.S === classId &&
            log.student_id?.S
        ) {
            attendedStudents.add(log.student_id.S);
        }
    });


    const totalStudents = enrolledStudents.size;


    classStatistics[classId] = {
        total_students: totalStudents,
        attendance_count: attendedStudents.size,
        attendance_rate:
            `${attendedStudents.size}/${totalStudents}`,
        attendance_percent:
            totalStudents === 0
                ? 0
                : Math.round(
                    (attendedStudents.size / totalStudents) * 100
                )
    };

});
       // 6. Ghép thông tin và định dạng kết quả trả về
const responseData = logs.map(log => {

    const studentId = log.student_id?.S || "";
    const fullName = userMap[studentId] || studentId;

    const stats = classStatistics[log.class_id?.S] || {
        total_students: 0,
        attendance_count: 0,
        attendance_rate: "0/0",
        attendance_percent: 0
    };


    return {
        class_id: log.class_id?.S || "",
        student_id: studentId,
        id: studentId,

        full_name: fullName,
        name: fullName,

        time: formatTimeVietnam(log.timestamp?.S),
        timestamp: log.timestamp?.S,

        status: log.status?.S || "PRESENT",

        total_students: stats.total_students,
        attendance_count: stats.attendance_count,
        attendance_rate: stats.attendance_rate,
        attendance_percent: stats.attendance_percent
    };

});


// Sắp xếp điểm danh mới nhất lên đầu
responseData.sort(
    (a, b) =>
        new Date(b.timestamp) - new Date(a.timestamp)
);


return {
    statusCode: 200,
    isBase64Encoded: false,
    headers: {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(responseData)
};

    } catch (error) {
        console.error("Lỗi trong handler getAttendance:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ message: error.message })
        };
    }
};
