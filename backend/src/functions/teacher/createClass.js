const { DynamoDBClient, GetItemCommand, PutItemCommand, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
const { generateRandomToken } = require("../../utils/helpers");
const crypto = require("crypto");

const client = new DynamoDBClient({ region: "ap-southeast-1" }); // Khu vực Singapore gần VN nhất

exports.handler = async (event) => {
    try {
        const body = JSON.parse(event.body);
        const { teacher_id, schedule_id, latitude: teacherLatitude, longitude: teacherLongitude } = body;
        console.log("REQUEST BODY:", body);
        console.log("GPS:", teacherLatitude, teacherLongitude);
        if (!schedule_id) {
            return {
                statusCode: 400,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ message: "Thiếu schedule_id" })
            };
        }

        // 1. Kiểm tra schedule_id tồn tại và đọc schedule tương ứng trong QR_Attendance_Schedules
        const getScheduleCommand = new GetItemCommand({
            TableName: "QR_Attendance_Schedules",
            Key: { schedule_id: { S: schedule_id } }
        });
        const scheduleData = await client.send(getScheduleCommand);

        if (!scheduleData.Item) {
            return {
                statusCode: 404,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ message: "Lịch dạy không tồn tại!" })
            };
        }

        const schedule = scheduleData.Item;
        const class_id = schedule.class_id.S;
        const course_id = schedule.course_id.S;
        const room = schedule.room.S;
        const day = schedule.day.S;
        const start_time = schedule.start_time.S;
        const end_time = schedule.end_time.S;
        const actual_teacher_id = schedule.teacher_id ? schedule.teacher_id.S : teacher_id;

        // Sinh QR token theo đúng logic hiện tại. KHÔNG thay đổi
        const newToken = generateRandomToken();
        const expiredAt = Date.now() + 35000; // Hết hạn sau 35 giây (cho 5 giây bù độ trễ mạng)

        // Đọc lớp học hiện tại để lấy tọa độ latitude/longitude cũ (nếu có) giữ tính tương thích cho điểm danh
        const getClassCommand = new GetItemCommand({
            TableName: "QR_Attendance_Classes",
            Key: { class_id: { S: class_id } }
        });
        const classData = await client.send(getClassCommand);

        let latitude = "0";
        let longitude = "0";

        // Ưu tiên GPS realtime từ frontend
        if (
            teacherLatitude !== undefined &&
            teacherLatitude !== null &&
            teacherLongitude !== undefined &&
            teacherLongitude !== null
        ) {
            latitude = teacherLatitude.toString();
            longitude = teacherLongitude.toString();
        }
        // Nếu không có GPS thì fallback về tọa độ cũ
        else if (classData.Item) {
            latitude = classData.Item.latitude
                ? classData.Item.latitude.N
                : "0";

            longitude = classData.Item.longitude
                ? classData.Item.longitude.N
                : "0";
        }

        // Tạo phiên học tương ứng trong QR_Attendance_Sessions
        const sessionId = crypto.randomUUID();
        const putSessionCommand = new PutItemCommand({
            TableName: "QR_Attendance_Sessions",
            Item: {
                session_id: { S: sessionId },
                schedule_id: { S: schedule_id },
                teacher_id: { S: actual_teacher_id },
                token: { S: newToken },
                status: { S: "OPEN" },
                created_at: { S: new Date().toISOString() }
            }
        });
        await client.send(putSessionCommand);

        // Cập nhật Token mới và GPS hiện tại của giảng viên vào QR_Attendance_Classes
        const updateClassCommand = new UpdateItemCommand({
            TableName: "QR_Attendance_Classes",
            Key: { class_id: { S: class_id } },
            UpdateExpression: "SET current_token = :token, token_expired_at = :exp, latitude = :lat, longitude = :lon",
            ExpressionAttributeValues: {
                ":token": { S: newToken },
                ":exp": { N: expiredAt.toString() },
                ":lat": { N: latitude.toString() },
                ":lon": { N: longitude.toString() }
            }
        });

        console.log("FINAL GPS SAVE:");
        console.log("class_id:", class_id);
        console.log("latitude:", latitude);
        console.log("longitude:", longitude);

        await client.send(updateClassCommand);

        console.log("DynamoDB UPDATE SUCCESS");

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ message: "Tạo token thành công", token: newToken, expired_at: expiredAt })
        };
    } catch (error) {
        console.error("Lỗi trong createClass handler:", error);
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ error: error.message })
        };
    }
};