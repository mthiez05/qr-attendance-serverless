const {
    DynamoDBClient,
    ScanCommand,
    GetItemCommand,
} = require("@aws-sdk/client-dynamodb");

const { unmarshall } = require("@aws-sdk/util-dynamodb");

const client = new DynamoDBClient({
    region: "ap-southeast-1",
});

exports.handler = async (event) => {
    try {
        const student_id = event.queryStringParameters?.student_id;

        if (!student_id) {
            return {
                statusCode: 400,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                },
                body: JSON.stringify({
                    message: "student_id is required",
                }),
            };
        }

        // Lấy thông tin sinh viên
        const studentResult = await client.send(
            new GetItemCommand({
                TableName: "QR_Attendance_Users",
                Key: {
                    user_id: { S: student_id }
                }
            })
        );

        if (!studentResult.Item) {
            return {
                statusCode: 404,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                },
                body: JSON.stringify({
                    message: "Không tìm thấy sinh viên"
                }),
            };
        }

        const studentClass = studentResult.Item.class_id.S;

        const fullName =
            studentResult.Item.full_name?.S || student_id;
        const result = await client.send(
            new ScanCommand({
                TableName: "QR_Attendance_Logs",
            })
        );

        const logs = result.Items.map(unmarshall);

        const attendance = logs
            .filter(
                (item) =>
                    item.student_id === student_id &&
                    item.class_id === studentClass
            )
            .map(item => ({
                ...item,
                full_name: fullName,
                name: fullName
            }));

        attendance.sort(
            (a, b) =>
                new Date(b.timestamp) - new Date(a.timestamp)
        );

        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify(attendance),
        };
    } catch (err) {
        return {
            statusCode: 500,
            headers: {
                "Access-Control-Allow-Origin": "*",
            },
            body: JSON.stringify(err),
        };
    }
};