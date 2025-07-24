const messagesDiv = document.getElementById("messages");
const userInput = document.getElementById("user-input");
const sendButton = document.getElementById("send-button");

const API_URL = "http://localhost:3000/chat"; // Ensure this URL matches your backend

const md = new markdownit({
  html: false, // Sanitize HTML if present in markdown
  linkify: true, // Auto-convert URLs to links
  typographer: true, // Enable some common typographer replacements
});

let messageCount = 0; // To keep track for optional numbering
let isFirstAgentMessage = true; // Flag to track the very first agent message

// Define your icons here (SVG paths or Font Awesome classes)
// For simplicity, using SVG paths directly. You can find many free SVG icons online.
// Ensure these keywords match the expected headings from your AI model (case-insensitive for matching)
const headingIcons = {
  "problem identified": `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`, // Alert / Exclamation mark circle
  "detailed findings": `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="9 10"></line></svg>`, // File with lines (document/report)
  "recommended actions": `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`, // Checkmark in box / Actions
  analysis: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>`, // Magnifying Glass with Plus
  insights: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H7l5 10l5-10zM12 21.5L12 21.5C12 21.5 12 22 12 22C12 22 12 21.5 12 21.5Z" stroke-dasharray="0 5" stroke-dashoffset="0"></path><line x1="12" y1="2" x2="12" y2="22"></line><path d="M17 5H7l5 10l5-10z"></path></svg>`, // Lightbulb / Idea (simulated)
  summary: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>`, // Box with plus (Summary/Key Points)
  recommendations: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 10 7 8"></polyline></svg>`, // File with checkmark
  "related information": `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>`, // Info circle
  solution: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-8.81"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`, // Checkmark for solution
  steps: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>`, // Checklist
  conclusion: `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`, // Bar chart for conclusion
};

function addMessage(
  content,
  sender,
  isMarkdown = false,
  addFeedback = false,
  showNumberIcon = false,
) {
  if (sender === "agent" || sender === "user") {
    messageCount++;
  }

  const messageWrapper = document.createElement("div");
  messageWrapper.classList.add(`${sender}-message-wrapper`);

  if (sender === "agent") {
    const messageMetadata = document.createElement("div");
    messageMetadata.classList.add("message-metadata");

    const avatar = document.createElement("div");
    avatar.classList.add("avatar");
    avatar.innerHTML =
      '<img src="https://via.placeholder.com/24/6C63FF/FFFFFF?text=AI" alt="AI Avatar">';
    messageMetadata.appendChild(avatar);

    if (showNumberIcon && !isFirstAgentMessage) {
      const numberIcon = document.createElement("div");
      numberIcon.classList.add("message-number-icon");
      numberIcon.textContent = messageCount;
      messageMetadata.appendChild(numberIcon);
    }

    messageWrapper.appendChild(messageMetadata);
  }

  const messageElement = document.createElement("div");
  messageElement.classList.add("message");
  messageElement.classList.add(`${sender}-message`);

  // Create a content container within the message bubble for text and feedback
  const messageContentContainer = document.createElement("div");
  messageContentContainer.classList.add("message-content-container");

  if (isMarkdown) {
    messageContentContainer.innerHTML = md.render(content);

    // --- NEW: Inject icons after markdown rendering ---
    if (sender === "agent") {
      // Only for agent messages
      addHeadingIcons(messageContentContainer);
    }
    // --- END NEW ---
  } else {
    messageContentContainer.textContent = content;
  }

  messageElement.appendChild(messageContentContainer); // Append content first

  // Add feedback options only for agent messages if addFeedback is true AND it's NOT the first agent message
  if (sender === "agent" && addFeedback && !isFirstAgentMessage) {
    const feedbackArea = document.createElement("div"); // Container for buttons and comment
    feedbackArea.classList.add("feedback-area");

    const feedbackContainer = document.createElement("div");
    feedbackContainer.classList.add("feedback-container");
    feedbackContainer.innerHTML = `
            <button class="feedback-button thumb-up" data-feedback="up">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
            </button>
            <button class="feedback-button thumb-down" data-feedback="down">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zM17 2h3a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-3"></path></svg>
            </button>
            <button class="feedback-button flag-response" data-feedback="flag">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" y1="22" x2="4" y2="15"></line></svg>
            </button>
        `;
    feedbackArea.appendChild(feedbackContainer);

    messageElement.appendChild(feedbackArea); // Append the whole feedback area inside the message bubble

    // Add event listeners for feedback buttons
    feedbackContainer.querySelectorAll(".feedback-button").forEach((button) => {
      button.addEventListener("click", function () {
        const feedbackType = this.dataset.feedback;

        if (feedbackType === "flag") {
          openFeedbackModal(content);
          return;
        }

        feedbackContainer.querySelectorAll(".feedback-button").forEach((btn) => btn.classList.remove("active"));
        this.classList.add("active");
        
        console.log(`Feedback received: ${feedbackType}`);
        
        let existingThanks = feedbackArea.querySelector('.feedback-thanks');
        if (!existingThanks) {
          const thanksMessage = document.createElement('div');
          thanksMessage.className = 'feedback-thanks';
          thanksMessage.textContent = 'Thank you for your feedback!';
          feedbackArea.insertBefore(thanksMessage, feedbackContainer);
        }
        
        if (feedbackType === "down") {
          openFeedbackModal(content);
        }
      });
    });
  }

  messageWrapper.appendChild(messageElement);
  messagesDiv.appendChild(messageWrapper);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  if (sender === "agent" && isFirstAgentMessage) {
    isFirstAgentMessage = false;
  }
}

/**
 * Iterates through heading elements within a given container and prepends
 * an SVG icon if the heading text matches a defined keyword.
 * @param {HTMLElement} container The DOM element containing the rendered markdown.
 */
function addHeadingIcons(container) {
  // Get all heading tags within the message content
  const headings = container.querySelectorAll("h1, h2, h3, h4, h5, h6");

  headings.forEach((heading) => {
    // Get the clean text of the heading, convert to lowercase for consistent matching
    const headingText = heading.textContent.trim().toLowerCase();

    // Check if any part of the heading text matches a keyword in our headingIcons map
    for (const keyword in headingIcons) {
      // Use includes to match "Problem Identified" even if the heading is "Problem Identified for X"
      if (headingText.includes(keyword)) {
        const iconSvg = headingIcons[keyword];
        const iconElement = document.createElement("span"); // Use span to wrap SVG
        iconElement.classList.add("heading-icon");
        iconElement.innerHTML = iconSvg; // Insert SVG directly

        // Prepend the icon to the heading element
        // We clear existing text and re-add it to avoid issues with text nodes
        const originalText = heading.textContent; // Get text before manipulating children
        heading.innerHTML = ""; // Clear current content
        heading.appendChild(iconElement);
        heading.appendChild(document.createTextNode(" " + originalText)); // Add space and original text
        break; // Found a match, no need to check other keywords for this heading
      }
    }
  });
}

async function sendMessage() {
  const query = userInput.value.trim();
  if (query === "") return;

  const userMessageWrapper = document.createElement("div");
  userMessageWrapper.classList.add("user-message-wrapper");

  const userMessageElement = document.createElement("div");
  userMessageElement.classList.add("message");
  userMessageElement.classList.add("user-message");
  userMessageElement.textContent = query;
  userMessageWrapper.appendChild(userMessageElement);

  messagesDiv.appendChild(userMessageWrapper);

  userInput.value = "";

  const typingIndicator = document.createElement("div");
  typingIndicator.classList.add("typing-indicator");
  typingIndicator.innerHTML =
    "Genie+ is typing<span>.</span><span>.</span><span>.</span>";
  messagesDiv.appendChild(typingIndicator);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userQuery: query }),
    });

    if (typingIndicator.parentNode) {
      typingIndicator.remove();
    }

    const data = await response.json();
    console.log("Received data from server:", data);

    if (response.ok) {
      let messageToDisplay = "";

      if (Array.isArray(data.response)) {
        messageToDisplay = data.response
          .filter(
            (part) => part.type === "text" && typeof part.text === "string",
          )
          .map((part) => part.text)
          .join("\n\n");

        const toolCalls = data.response.filter(
          (part) => part.type === "tool_use",
        );
        if (toolCalls.length > 0) {
          console.log("Genie+ made tool calls:", toolCalls);
          if (messageToDisplay === "") {
            messageToDisplay =
              "Genie+ is processing your request using internal tools...";
          }
        }
      } else if (typeof data.response === "string") {
        messageToDisplay = data.response;
      } else {
        console.warn(
          "Received data.response does not match expected chat message array or string. Falling back to stringifying.",
        );
        messageToDisplay = JSON.stringify(data.response, null, 2);
      }

      const showNumber = messageToDisplay.includes(
        "Learning from Production Data",
      );
      addMessage(messageToDisplay, "agent", true, true, showNumber);
    } else {
      addMessage(
        `Error: ${data.error || "Something went wrong on the server."}`,
        "agent",
        false,
        false,
      );
      console.error("API Error:", data.error);
    }
  } catch (error) {
    if (typingIndicator.parentNode) {
      typingIndicator.remove();
    }
    addMessage(
      "Network error: Could not reach the server. Please check your server and network connection.",
      "agent",
      false,
      false,
    );
    console.error("Fetch error:", error);
  }
}

sendButton.addEventListener("click", sendMessage);
userInput.addEventListener("keypress", (event) => {
  if (event.key === "Enter") {
    sendMessage();
  }
});

// Feedback Modal Functions
function generateRequestId() {
  return Math.random().toString(36).substr(2, 9) + '-' + 
         Math.random().toString(36).substr(2, 4) + '-' + 
         Math.random().toString(36).substr(2, 4) + '-' + 
         Math.random().toString(36).substr(2, 4) + '-' + 
         Math.random().toString(36).substr(2, 12);
}

function openFeedbackModal(messageContent) {
  const modal = document.getElementById('feedback-modal');
  const requestIdSpan = document.getElementById('request-id');
  
  // Generate and display request ID
  requestIdSpan.textContent = generateRequestId();
  
  // Clear previous form data
  document.getElementById('freeform-feedback').value = '';
  document.getElementById('source-document').value = '';
  document.querySelectorAll('input[name="reason"]').forEach(radio => {
    radio.checked = false;
  });
  
  modal.style.display = 'block';
  document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

function closeFeedbackModal() {
  const modal = document.getElementById('feedback-modal');
  modal.style.display = 'none';
  document.body.style.overflow = 'auto'; // Restore scrolling
}

function submitFeedback() {
  const freeformFeedback = document.getElementById('freeform-feedback').value.trim();
  const sourceDocument = document.getElementById('source-document').value.trim();
  const selectedReason = document.querySelector('input[name="reason"]:checked')?.value;
  const requestId = document.getElementById('request-id').textContent;
  
  // Collect feedback data
  const feedbackData = {
    requestId,
    freeformFeedback,
    reason: selectedReason,
    sourceDocument,
    timestamp: new Date().toISOString()
  };
  
  console.log('Feedback submitted:', feedbackData);
  
  // Here you would send the feedback to your backend
  // await sendFeedbackToBackend(feedbackData);
  
  closeFeedbackModal();
  
  // Show success message (optional)
  alert('Thank you for your feedback! We appreciate your input.');
}

document.addEventListener("DOMContentLoaded", () => {
  const existingInitialAgentMessage = messagesDiv.querySelector(
    ".agent-message-wrapper",
  );
  if (existingInitialAgentMessage) {
    existingInitialAgentMessage.remove();
  }
  addMessage(
    "Hello! I'm Genie+ Assistant. How can I help you today?",
    "agent",
    false,
    false,
    false,
  );
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
  
  // Modal event listeners
  const modal = document.getElementById('feedback-modal');
  const closeBtn = document.querySelector('.modal-close');
  const cancelBtn = document.querySelector('.btn-cancel');
  const submitBtn = document.querySelector('.btn-submit');
  
  closeBtn.addEventListener('click', closeFeedbackModal);
  cancelBtn.addEventListener('click', closeFeedbackModal);
  submitBtn.addEventListener('click', submitFeedback);
  
  // Close modal when clicking outside
  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      closeFeedbackModal();
    }
  });
  
  // Close modal with Escape key
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.style.display === 'block') {
      closeFeedbackModal();
    }
  });
});
