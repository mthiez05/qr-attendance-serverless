const {
    DynamoDBClient,
    GetItemCommand,
    PutItemCommand,
    ScanCommand
} = require("@aws-sdk/client-dynamodb");
const { getDistanceInMeters } = require("../../utils/helpers");
const crypto = require("crypto");

const client = new DynamoDBClient({ region: "ap-southeast-1" });

exports.handler = async (event) => {
    try {
        const body = JSON.parse(event.body);
        const { student_id, class_id, token, student_lat, student_lon } = body;

        // 1. Lấy thông tin lớp học từ DynamoDB để kiểm tra mã Token và Tọa độ gốc
        const getClassCommand = new GetItemCommand({
            TableName: "QR_Attendance_Classes",
            Key: { class_id: { S: class_id } }
        });
        const classData = await client.send(getClassCommand);

        if (!classData.Item) {
            return { statusCode: 404, body: JSON.stringify({ message: "Không tìm thấy lớp học!" }) };
        }

        const classInfo = classData.Item;
        const correctToken = classInfo.current_token.S;
        const tokenExpiredAt = parseInt(classInfo.token_expired_at.N);
        const teacherLat = parseFloat(classInfo.latitude.N);
        const teacherLon = parseFloat(classInfo.longitude.N);
        // 2. Kiểm tra sinh viên có thuộc lớp học này không
        const enrollmentResult = await client.send(
            new ScanCommand({
                TableName: "QR_Attendance_Enrollments",
                FilterExpression: "student_id = :sid AND class_id = :cid",
                ProjectionExpression: "student_id, class_id",
                ExpressionAttributeValues: {
                    ":sid": { S: student_id },
                    ":cid": { S: class_id }
                }
            })
        );


        if (!enrollmentResult.Items || enrollmentResult.Items.length === 0) {
            return {
                statusCode: 403,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({
                    message: "Bạn không đăng ký lớp học này!"
                })
            };
        }
        // 2. Kiểm tra tính hợp lệ của mã Token (Mã QR)
        if (token !== correctToken || Date.now() > tokenExpiredAt) {
            return {
                statusCode: 400,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ message: "Mã QR đã hết hạn hoặc không chính xác. Hãy quét lại mã mới!" })
            };
        }

        // 3. Kiểm tra vị trí GPS chống gian lận (Bán kính 50 mét)
        // DEBUG START
        const debugDistance = getDistanceInMeters(student_lat, student_lon, teacherLat, teacherLon);
        const debugDecision = debugDistance <= 50 ? "PASS" : "FAIL";
        console.log("Teacher GPS:");
        console.log("latitude");
        console.log(teacherLat);
        console.log("longitude");
        console.log(teacherLon);
        console.log("Student GPS:");
        console.log("latitude");
        console.log(student_lat);
        console.log("longitude");
        console.log(student_lon);
        console.log("Calculated distance (meters)");
        console.log(debugDistance);
        console.log("Allowed radius");
        console.log(50);
        console.log("Decision (PASS / FAIL)");
        console.log(debugDecision);
        // DEBUG END

        const distance = getDistanceInMeters(student_lat, student_lon, teacherLat, teacherLon);
        if (distance > 50) {
            return {
                statusCode: 400,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({
                    message: `Điểm danh thất bại! Bạn đang ở quá xa lớp học (${Math.round(distance)}m).`,
                    // DEBUG START
                    teacher_lat: teacherLat,
                    teacher_lon: teacherLon,
                    student_lat: student_lat,
                    student_lon: student_lon,
                    distance: distance,
                    allowed_radius: 50
                    // DEBUG END
                })
            };
        }

        // 4. Mọi thứ hợp lệ -> Ghi nhật ký điểm danh vào DynamoDB
        const logId = crypto.randomUUID();
        const putLogCommand = new PutItemCommand({
            TableName: "QR_Attendance_Logs",
            Item: {
                log_id: { S: logId },
                student_id: { S: student_id },
                class_id: { S: class_id },
                timestamp: { S: new Date().toISOString() },
                status: { S: "PRESENT" },
                distance_meters: { N: distance.toFixed(1) }
            }
        });
        await client.send(putLogCommand);

        return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: "Điểm danh thành công!", distance: `${distance.toFixed(1)}m` })
        };

    } catch (error) {
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: error.message })
        };
    }
};