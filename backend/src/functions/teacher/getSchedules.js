const { DynamoDBClient, ScanCommand, GetItemCommand } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: "ap-southeast-1" });

exports.handler = async (event) => {
    const headers = {
        "Access-Control-Allow-Origin": "*",
        "Content-Type": "application/json"
    };

    try {
        // 1. Nhận và kiểm tra tham số teacher_id từ query parameters
        const queryParams = event.queryStringParameters || {};
        const teacherId = queryParams.teacher_id;

        if (!teacherId || teacherId.trim() === "") {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ message: "Missing or invalid teacher_id parameter" })
            };
        }

        // 2. Scan bảng QR_Attendance_Schedules lọc theo teacher_id
        const scanSchedulesCommand = new ScanCommand({
            TableName: "QR_Attendance_Schedules",
            FilterExpression: "teacher_id = :teacher_id",
            ExpressionAttributeValues: {
                ":teacher_id": { S: teacherId }
            }
        });

        const schedulesData = await client.send(scanSchedulesCommand);
        const schedules = schedulesData.Items || [];

        // Nếu giảng viên không có lịch trình nào, trả về mảng rỗng ngay lập tức
        if (schedules.length === 0) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify([])
            };
        }

        // 3. Gom danh sách course_id không trùng lặp để tối ưu hóa lượt gọi database
        const courseIds = [...new Set(schedules.map(item => item.course_id?.S).filter(Boolean))];

        // 4. Lấy thông tin course_name từ bảng QR_Attendance_Courses song song
        const courseMap = {};
        await Promise.all(courseIds.map(async (courseId) => {
            try {
                const getCourseCommand = new GetItemCommand({
                    TableName: "QR_Attendance_Courses",
                    Key: { course_id: { S: courseId } }
                });
                const courseData = await client.send(getCourseCommand);
                if (courseData.Item && courseData.Item.course_name) {
                    courseMap[courseId] = courseData.Item.course_name.S;
                } else {
                    courseMap[courseId] = "";
                }
            } catch (err) {
                console.error(`Lỗi khi lấy thông tin course_id ${courseId}:`, err);
                courseMap[courseId] = "";
            }
        }));

        // 5. Ghép thông tin và định dạng kết quả trả về
        const responseData = schedules.map(item => {
            const courseId = item.course_id?.S || "";
            return {
                schedule_id: item.schedule_id?.S || "",
                course_id: courseId,
                course_name: courseMap[courseId] || "",
                class_id: item.class_id?.S || "",
                room: item.room?.S || "",
                day: item.day?.S || "",
                start_time: item.start_time?.S || "",
                end_time: item.end_time?.S || ""
            };
        });

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify(responseData)
        };

    } catch (error) {
        console.error("Lỗi trong handler getSchedules:", error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ message: error.message })
        };
    }
};
