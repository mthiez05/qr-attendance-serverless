const { DynamoDBClient, ScanCommand } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({ region: "ap-southeast-1" });

exports.handler = async (event) => {
    try {
        if (!event.body) {
            return {
                statusCode: 400,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ message: "Request body is missing" })
            };
        }

        const body = JSON.parse(event.body);
        const { email, password } = body;

        if (!email || !password) {
            return {
                statusCode: 400,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ message: "Email and password are required" })
            };
        }

        // Perform scan on QR_Attendance_Users table to find user by email
        const command = new ScanCommand({
            TableName: "QR_Attendance_Users",
            FilterExpression: "email = :email",
            ExpressionAttributeValues: {
                ":email": { S: email }
            }
        });

        const data = await client.send(command);

        if (!data.Items || data.Items.length === 0) {
            return {
                statusCode: 401,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ message: "Invalid email or password" })
            };
        }

        const user = data.Items[0];
        const storedPasswordHash = user.password_hash ? user.password_hash.S : "";

        // Compare password directly (plain text comparison for now)
        if (password !== storedPasswordHash) {
            return {
                statusCode: 401,
                headers: { "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ message: "Invalid email or password" })
            };
        }

        return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({
                user_id: user.user_id.S,
                full_name: user.full_name ? user.full_name.S : "",
                email: user.email ? user.email.S : "",
                role: user.role ? user.role.S : "",
                status: user.status ? user.status.S : ""
            })
        };

    } catch (error) {
        console.error("Login error:", error);
        return {
            statusCode: 500,
            headers: { "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify({ message: error.message })
        };
    }
};
