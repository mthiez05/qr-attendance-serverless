const {
    DynamoDBClient,
    GetItemCommand,
    ScanCommand
} = require("@aws-sdk/client-dynamodb");

const { unmarshall } = require("@aws-sdk/util-dynamodb");

const client = new DynamoDBClient({
    region: "ap-southeast-1",
});

exports.handler = async (event) => {
    try {
        const studentId = event.queryStringParameters?.student_id;

        if (!studentId) {
            return {
                statusCode: 400,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({
                    message: "Thiếu student_id"
                })
            };
        }

        // Lấy danh sách lớp sinh viên đăng ký
        const enrollmentResult = await client.send(
            new ScanCommand({
                TableName: "QR_Attendance_Enrollments"
            })
        );

        const enrollments = enrollmentResult.Items
            .map(item => unmarshall(item))
            .filter(item => item.student_id === studentId);

        if (enrollments.length === 0) {
            return {
                statusCode: 404,
                headers: {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "*"
                },
                body: JSON.stringify({
                    message: "Sinh viên chưa đăng ký lớp nào"
                })
            };
        }

        const classIds = enrollments.map(item => item.class_id);

        // Lấy lịch học
        const scheduleResult = await client.send(
            new ScanCommand({
                TableName: "QR_Attendance_Schedules"
            })
        );

        const schedules = scheduleResult.Items
            .map(item => unmarshall(item))
            .filter(item => classIds.includes(item.class_id));

        // Lấy tên môn học
        const courseMap = {};

        const courseIds = [...new Set(schedules.map(s => s.course_id))];

        await Promise.all(
            courseIds.map(async (courseId) => {
                try {
                    const courseResult = await client.send(
                        new GetItemCommand({
                            TableName: "QR_Attendance_Courses",
                            Key: {
                                course_id: {
                                    S: courseId
                                }
                            }
                        })
                    );

                    if (courseResult.Item) {
                        const course = unmarshall(courseResult.Item);
                        courseMap[courseId] = course.course_name;
                    } else {
                        courseMap[courseId] = "";
                    }
                } catch (err) {
                    console.error(err);
                    courseMap[courseId] = "";
                }
            })
        );

        // Ghép course_name vào kết quả
        const response = schedules.map(schedule => ({
            ...schedule,
            course_name: courseMap[schedule.course_id] || ""
        }));

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify(response)
        };

    } catch (err) {
        console.error(err);

        return {
            statusCode: 500,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                message: "Internal Server Error"
            })
        };
    }
};