# AI-Driven Geospatial Dashboard

An intelligent web-based dashboard that integrates OGC Web Services (WMS, WFS, SOS) with Generative AI (Gemini 1.5 Flash). Users can visualize geospatial data, fetch sensor readings, and generate maps using natural language commands, eliminating the need to manually configure complex service parameters.

![Dashboard Screenshot]('Screenshot from 2026-02-07 16-39-51.png')

## Requirements & Dependencies

### Software Requirements
* **Modern Web Browser** (Chrome, Firefox, Edge)
* **Python 3.x** (Required to run the local web server to handle CORS)
* **Google Gemini API Key** (Required for AI functionality)
* **GeoServer** (For hosting WMS and WFS layers)
* **istSOS** (For hosting Sensor Observation Service data)


## External Services Setup

To fully utilize the dashboard, you need running instances of OGC-compliant servers.

* **GeoServer Installation Guide:**
    http://geoserver.org/download/
    *Used for Web Map Service (WMS) and Web Feature Service (WFS).*

* **istSOS Installation Guide:**
    http://istsos.org/en/trunk/doc/installation.html
    *Used for Sensor Observation Service (SOS).*

## Installation & Setup

### 1. Clone the Repository
Download the project files to your local machine.

### 2. Configure API Key
1.  Open `llm_controller.js` in a text editor.
2.  Locate the constant `GEMINI_API_KEY`.
3.  Replace the placeholder string with your actual Google Gemini API key.

### 3. Run the Application
Due to browser CORS security policies, this application cannot be run by opening the HTML file directly. It must be served via a local web server.

Open your terminal or command prompt in the project directory and run:

```bash
# Python 3
python -m http.server 8000
