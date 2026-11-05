require("dotenv").config();

const path = require("path");
const express = require("express");

const {
    BedrockRuntimeClient,
    ConverseCommand
} = require("@aws-sdk/client-bedrock-runtime");

const app = express();

const PORT = Number(process.env.PORT) || 3000;
const AWS_REGION = process.env.AWS_REGION;
const MODEL_ID = process.env.BEDROCK_MODEL_ID;

if (!AWS_REGION) {
    console.error("AWS_REGION is missing from the .env file.");
    process.exit(1);
}

if (!MODEL_ID) {
    console.error("BEDROCK_MODEL_ID is missing from the .env file.");
    process.exit(1);
}

const bedrockClient = new BedrockRuntimeClient({
    region: AWS_REGION
});

app.use(express.json({
    limit: "20kb"
}));

app.use(express.static(
    path.join(__dirname, "public")
));

const SYSTEM_PROMPT = `
You are an Electrical Engineering Assistant.

Your scope includes:

- Ohm's law
- DC and AC electrical calculations
- Single-phase and three-phase power
- Current calculations
- Voltage drop
- Power factor
- Energy consumption
- kW, kVA, kVAR and kWh
- Basic cable sizing
- Basic circuit-breaker sizing
- Motor calculations
- Battery capacity and autonomy
- Solar PV energy calculations
- Generator sizing fundamentals
- Telecom site power fundamentals

When answering a numerical question, use this structure:

1. Given parameters
2. Required quantity
3. Formula
4. Substitution
5. Calculation
6. Result
7. Assumptions
8. Engineering considerations

Always show units.

Clearly distinguish between:

- A calculated minimum value
- A practical engineering selection
- A value that requires verification against a standard

Never invent missing values.

If an essential parameter is missing, identify the missing parameter
and explain why it is required.

For cable selection, consider that the final cable size may depend on:

- Conductor material
- Cable insulation
- Installation method
- Current-carrying capacity
- Ambient temperature
- Cable grouping
- Voltage-drop limit
- Cable length
- Short-circuit withstand
- Protective-device coordination
- Applicable electrical standard

For circuit-breaker selection, explain the relationship:

Ib ≤ In ≤ Iz

where:

- Ib is the design current
- In is the protective-device rating
- Iz is the cable current-carrying capacity

Do not present the response as a substitute for an approved electrical
design, site assessment, manufacturer's instructions, or applicable
electrical regulations.

If the user asks an unrelated question, politely explain that the
application is limited to basic electrical and energy-engineering topics.
`;

function extractText(content) {
    if (!Array.isArray(content)) {
        return "";
    }

    return content
        .filter(block => typeof block.text === "string")
        .map(block => block.text)
        .join("\n")
        .trim();
}

app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        service: "Electrical Engineering Assistant",
        region: AWS_REGION,
        modelConfigured: Boolean(MODEL_ID)
    });
});

app.post("/api/ask", async (req, res) => {
    try {
        const body =
            req.body && typeof req.body === "object"
                ? req.body
                : {};

        const question =
            typeof body.question === "string"
                ? body.question.trim()
                : "";

        if (!question) {
            return res.status(400).json({
                error: "Please enter an electrical engineering question."
            });
        }

        if (question.length > 4000) {
            return res.status(400).json({
                error: "The question must be 4,000 characters or fewer."
            });
        }

        const command = new ConverseCommand({
            modelId: MODEL_ID,

            system: [
                {
                    text: SYSTEM_PROMPT
                }
            ],

            messages: [
                {
                    role: "user",
                    content: [
                        {
                            text: question
                        }
                    ]
                }
            ],

            inferenceConfig: {
                maxTokens: 1800,
                temperature: 0.1,
                topP: 0.9
            }
        });

        const response = await bedrockClient.send(command);

        const answer = extractText(
            response.output?.message?.content
        );

        if (!answer) {
            throw new Error(
                "Amazon Bedrock returned an empty response."
            );
        }

        res.json({
            answer,
            usage: {
                inputTokens:
                    response.usage?.inputTokens ?? null,

                outputTokens:
                    response.usage?.outputTokens ?? null,

                totalTokens:
                    response.usage?.totalTokens ?? null
            },

            stopReason:
                response.stopReason ?? null
        });
    } catch (error) {
        console.error("Bedrock request failed:", error);

        if (error.name === "AccessDeniedException") {
            return res.status(403).json({
                error:
                    "Access was denied. Confirm model access and the bedrock:InvokeModel IAM permission."
            });
        }

        if (error.name === "ResourceNotFoundException") {
            return res.status(404).json({
                error:
                    "The configured Bedrock model was not found in this AWS Region. Check AWS_REGION and BEDROCK_MODEL_ID."
            });
        }

        if (error.name === "ValidationException") {
            return res.status(400).json({
                error:
                    "Amazon Bedrock rejected the request. Confirm that the selected model supports the Converse API and that the model ID is correct."
            });
        }

        if (
            error.name === "CredentialsProviderError" ||
            error.name === "UnrecognizedClientException"
        ) {
            return res.status(500).json({
                error:
                    "AWS credentials were not found or are invalid. Configure an AWS CLI profile, IAM Identity Center session, or IAM role."
            });
        }

        res.status(500).json({
            error:
                "The application could not obtain an answer from Amazon Bedrock."
        });
    }
});

app.use((req, res) => {
    res.status(404).json({
        error: "Route not found."
    });
});

app.listen(PORT, () => {
    console.log("");
    console.log("Electrical Engineering Assistant started.");
    console.log(`Address: http://localhost:${PORT}`);
    console.log(`AWS Region: ${AWS_REGION}`);
    console.log(`Bedrock model: ${MODEL_ID}`);
    console.log("");
});