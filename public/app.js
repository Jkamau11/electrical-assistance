const form = document.getElementById("questionForm");
const questionInput = document.getElementById("question");
const askButton = document.getElementById("askButton");
const clearButton = document.getElementById("clearButton");
const copyButton = document.getElementById("copyButton");

const statusElement = document.getElementById("status");
const answerCard = document.getElementById("answerCard");
const answerElement = document.getElementById("answer");
const tokenUsage = document.getElementById("tokenUsage");
const characterCount = document.getElementById("characterCount");

const exampleButtons =
    document.querySelectorAll(".example-button");

function updateCharacterCount() {
    const length = questionInput.value.length;

    characterCount.textContent =
        `${length} / 4000`;
}

function setStatus(message, type = "") {
    statusElement.textContent = message;

    statusElement.className = "status-message";

    if (type) {
        statusElement.classList.add(type);
    }
}

function setLoading(isLoading) {
    askButton.disabled = isLoading;
    clearButton.disabled = isLoading;
    questionInput.disabled = isLoading;

    askButton.textContent =
        isLoading
            ? "Calculating..."
            : "Ask Assistant";
}

function showTokenUsage(usage) {
    if (!usage) {
        tokenUsage.textContent = "";
        return;
    }

    const input = usage.inputTokens;
    const output = usage.outputTokens;
    const total = usage.totalTokens;

    if (
        input === null &&
        output === null &&
        total === null
    ) {
        tokenUsage.textContent = "";
        return;
    }

    tokenUsage.textContent =
        `Tokens: input ${input ?? "n/a"}, ` +
        `output ${output ?? "n/a"}, ` +
        `total ${total ?? "n/a"}`;
}

async function askQuestion(question) {
    setLoading(true);
    setStatus("Sending the question to Amazon Bedrock...", "loading");

    answerCard.classList.add("hidden");
    answerElement.textContent = "";
    tokenUsage.textContent = "";

    try {
        const response = await fetch("/api/ask", {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                question
            })
        });

        let data;

        try {
            data = await response.json();
        } catch {
            throw new Error(
                "The server returned an invalid response."
            );
        }

        if (!response.ok) {
            throw new Error(
                data.error ||
                "The request could not be completed."
            );
        }

        answerElement.textContent = data.answer;
        showTokenUsage(data.usage);

        answerCard.classList.remove("hidden");

        setStatus(
            "Response completed successfully.",
            "success"
        );

        answerCard.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    } catch (error) {
        console.error(error);

        setStatus(
            error.message ||
            "The assistant could not answer the question.",
            "error"
        );
    } finally {
        setLoading(false);
        questionInput.focus();
    }
}

form.addEventListener("submit", async event => {
    event.preventDefault();

    const question = questionInput.value.trim();

    if (!question) {
        setStatus(
            "Please enter an electrical engineering question.",
            "error"
        );

        questionInput.focus();
        return;
    }

    if (question.length > 4000) {
        setStatus(
            "The question must be 4,000 characters or fewer.",
            "error"
        );

        return;
    }

    await askQuestion(question);
});

questionInput.addEventListener(
    "input",
    updateCharacterCount
);

clearButton.addEventListener("click", () => {
    questionInput.value = "";
    answerElement.textContent = "";
    tokenUsage.textContent = "";

    answerCard.classList.add("hidden");

    setStatus("");
    updateCharacterCount();

    questionInput.focus();
});

copyButton.addEventListener("click", async () => {
    const answer = answerElement.textContent.trim();

    if (!answer) {
        setStatus(
            "There is no answer to copy.",
            "error"
        );

        return;
    }

    try {
        await navigator.clipboard.writeText(answer);

        setStatus(
            "The answer was copied to the clipboard.",
            "success"
        );
    } catch {
        setStatus(
            "The browser could not copy the answer.",
            "error"
        );
    }
});

exampleButtons.forEach(button => {
    button.addEventListener("click", () => {
        const exampleQuestion =
            button.dataset.question || "";

        questionInput.value = exampleQuestion;

        updateCharacterCount();
        setStatus("");

        questionInput.focus();
    });
});

updateCharacterCount();