const { DynamoDBClient, UpdateItemCommand } = require("@aws-sdk/client-dynamodb");
const { generateRandomToken } = require("../../utils/helpers");

const client = new DynamoDBClient({ region: "ap-southeast-1" }); // Khu vực Singapore gần VN nhất

exports.handler = async (event) => {
    try {
        const body = JSON.parse(event.body);
        const { class_id, latitude, longitude } = body;

        const newToken = generateRandomToken();
        const expiredAt = Date.now() + 35000; // Hết hạn sau 35 giây (cho 5 giây bù độ trễ mạng)

        // DEBUG START
        const token = newToken;
        const Item = { latitude: { N: latitude.toString() }, longitude: { N: longitude.toString() } };

        console.log("Teacher GPS received:");
        console.log("latitude =", latitude);
        console.log("longitude =", longitude);

        console.log("Teacher GPS stored in DynamoDB:");
        console.log("latitude =", Item.latitude.N);
        console.log("longitude =", Item.longitude.N);

        console.log("Generated token =", token);
        // DEBUG END

        // Cập nhật Token mới và Tọa độ lớp học vào DynamoDB
        const command = new UpdateItemCommand({
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

        await client.send(command);

        return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" }, // Cấu hình CORS để Frontend gọi được
            body: JSON.stringify({ message: "Tạo token thành công", token: newToken, expired_at: expiredAt })
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ error: error.message })
        };
    }
};