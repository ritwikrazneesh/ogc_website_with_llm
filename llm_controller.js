// llm_controller.js
// Handles interaction between the DOM and Gemini 1.5 Flash

// --- 1. CONFIGURATION ---
// REPLACE THIS WITH YOUR ACTUAL API KEY
const GEMINI_API_KEY = "AIzaSyAilB1zngbBqF9sSMmYHwdX9iM7mXcquRY"; 
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${GEMINI_API_KEY}`;

const appConfig = {
    wms: {
        tabId: "Tab1",
        triggerId: "wms-getcapabilities",
        submitId: "wms-submit",
        fields: {
            layer: { id: "layer-dropdown", type: "select", desc: "Layer Name" },
            crs: { id: "crs-dropdown", type: "select", desc: "Coordinate Reference System" },
            format: { id: "format-dropdown", type: "select", desc: "Image Format" },
            minx: { id: "number11", type: "number", desc: "BBOX Min X" },
            miny: { id: "number111", type: "number", desc: "BBOX Min Y" },
            maxx: { id: "number22", type: "number", desc: "BBOX Max X" },
            maxy: { id: "number222", type: "number", desc: "BBOX Max Y" },
            width: { id: "number1", type: "number", desc: "Height" },   // Note: ID mapping fixed based on main.html
            height: { id: "number2", type: "number", desc: "Width" }
        }
    },
    wfs: {
        tabId: "Tab2",
        triggerId: "wfs-getcapabilities",
        submitId: "wfs-submit",
        fields: {
            layer: { id: "layer_dropdown_f", type: "select", desc: "Feature Type" },
            crs: { id: "crs_dropdown_f", type: "select", desc: "CRS" },
            format: { id: "format_dropdown_f", type: "select", desc: "Output Format" },
            minx: { id: "number11_f", type: "number", desc: "BBOX Min X" },
            miny: { id: "number111_f", type: "number", desc: "BBOX Min Y" },
            maxx: { id: "number22_f", type: "number", desc: "BBOX Max X" },
            maxy: { id: "number222_f", type: "number", desc: "BBOX Max Y" }
        }
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const aiBtn = document.getElementById('ai-submit-btn');
    const aiInput = document.getElementById('ai-query-input');

    if(aiBtn && aiInput) {
        aiBtn.addEventListener('click', () => handleAIRequest(aiInput.value));
        aiInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleAIRequest(aiInput.value);
        });
    }
});

async function handleAIRequest(query) {
    if (!query) return;
    updateStatus("Thinking...", "loading");

    try {
        // 1. Determine Service
        let service = "wms";
        if (query.toLowerCase().includes("feature") || query.toLowerCase().includes("vector")) {
            service = "wfs";
        }
        console.log(`[AI Controller] Selected Service: ${service}`);

        // 2. Open Tab
        const tabButton = document.querySelector(`.tablink[onclick*='${appConfig[service].tabId}']`);
        if (tabButton) tabButton.click();

        // 3. Trigger & Wait
        updateStatus("Fetching Server Data...", "loading");
        const config = appConfig[service];
        const triggerBtn = document.getElementById(config.triggerId);
        
        await triggerCapabilitiesAndWait(triggerBtn, config.fields.layer.id);

        // 4. Build Context
        const context = buildContext(service);
        console.log("[AI Controller] Context built:", context);

        if (!context.layer || !context.layer.options || context.layer.options.length === 0) {
            throw new Error("No layers found in dropdown. Check server URL or GetCapabilities.");
        }

        // 5. Call Gemini
        updateStatus("AI Generating Params...", "loading");
        const llmResponse = await callGemini(query, context, service);
        
        // 6. Apply
        if (llmResponse) {
            console.log("[AI Controller] AI Response:", llmResponse);
            updateStatus("Rendering Map...", "success");
            applyActions(service, llmResponse);
        } else {
            throw new Error("AI returned empty response.");
        }

    } catch (e) {
        console.error("[AI Controller Error]", e);
        updateStatus("Error: " + e.message, "error");
    }
}

function triggerCapabilitiesAndWait(btnElement, dropdownId) {
    return new Promise((resolve, reject) => {
        const dropdown = document.getElementById(dropdownId);
        if(!dropdown) { reject("Dropdown not found: " + dropdownId); return; }

        // Clear it first so we detect the CHANGE
        dropdown.innerHTML = ""; 
        
        console.log(`[AI Controller] Clicking ${btnElement.id} and waiting for ${dropdownId}...`);
        btnElement.click();

        let attempts = 0;
        const interval = setInterval(() => {
            attempts++;
            // Check if we have options (ignoring empty placeholders if possible, but >0 is a start)
            if (dropdown.options.length > 0) { 
                console.log(`[AI Controller] Dropdown populated with ${dropdown.options.length} items.`);
                clearInterval(interval);
                resolve();
            }
            if (attempts > 20) { // 10 seconds timeout
                clearInterval(interval);
                reject(new Error("Timeout waiting for GetCapabilities. Is the server running?"));
            }
        }, 500);
    });
}

function buildContext(service) {
    const config = appConfig[service];
    const context = {};

    for (const [key, field] of Object.entries(config.fields)) {
        const el = document.getElementById(field.id);
        if (!el) continue;

        context[key] = { description: field.desc };

        if (field.type === "select") {
            context[key].options = Array.from(el.options)
                .filter(opt => !opt.disabled && opt.value.trim() !== "")
                .map(opt => ({ value: opt.value, label: opt.innerText }));
        }
    }
    return context;
}

async function callGemini(userQuery, context, service) {
    const systemPrompt = `
    You are a GIS Assistant controlling a ${service.toUpperCase()} interface.
    
    CONTEXT (Available Layers & Fields):
    ${JSON.stringify(context)}

    USER QUERY: "${userQuery}"

    TASK:
    1. Select the most relevant 'layer' from the provided options.
    2. Select 'crs' (Prefer EPSG:4326).
    3. Select 'format' (image/png for WMS, application/json for WFS).
    4. Calculate Bounding Box (minx, miny, maxx, maxy) in EPSG:4326.
    5. Return 'width' and 'height' if specified (default 800, 600).
    
    OUTPUT:
    Return ONLY valid JSON. No markdown.
    `;

    const payload = { contents: [{ parts: [{ text: systemPrompt }] }] };

    const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
    });

    const data = await response.json();

    // ERROR HANDLING LOGGING
    if (data.error) {
        console.error("Gemini API Error Payload:", data.error);
        throw new Error(`Gemini API Error: ${data.error.message}`);
    }

    if (data.candidates && data.candidates[0].content) {
        let text = data.candidates[0].content.parts[0].text;
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(text);
    }
    return null;
}

function applyActions(service, actions) {
    const config = appConfig[service];

    for (const [key, value] of Object.entries(actions)) {
        const fieldId = config.fields[key]?.id;
        if (fieldId) {
            const el = document.getElementById(fieldId);
            if (el) {
                el.value = value;
                el.dispatchEvent(new Event('change'));
            }
        }
    }

    setTimeout(() => {
        const submitBtn = document.getElementById(config.submitId);
        if (submitBtn) submitBtn.click();
    }, 1000);
}

function updateStatus(msg, type) {
    const el = document.getElementById('ai-status');
    if(el) {
        el.innerText = msg;
        el.className = `ai-status ${type}`;
    }
}