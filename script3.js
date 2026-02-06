// script3.js - Complete SOS functionality with BBOX filtering and Google Charts visualization

let xmlDoc_s = null;
let sensorList = [];
let vectorLayer = null;
let popup = null;
let bboxLayer = null;
let currentBbox = null;
let currentSelectedSensorId = null;

// Initialize sensor layer and map components
function initSensorLayer() {
    const existingLayer = map.getLayers().getArray().find(layer => layer.get('name') === 'sensorLayer');
    
    if (existingLayer) {
        vectorLayer = existingLayer;
        vectorLayer.getSource().clear();
    } else {
        const vectorSource = new ol.source.Vector();
        vectorLayer = new ol.layer.Vector({
            source: vectorSource,
            name: 'sensorLayer',
            style: function(feature) {
                const isSelected = feature.get('id') === currentSelectedSensorId;
                return new ol.style.Style({
                    image: new ol.style.Circle({
                        radius: 7,
                        fill: new ol.style.Fill({ 
                            color: isSelected ? 'rgba(0, 255, 0, 0.7)' : 'rgba(255, 0, 0, 0.7)' 
                        }),
                        stroke: new ol.style.Stroke({ color: 'white', width: 2 })
                    })
                });
            }
        });
        map.addLayer(vectorLayer);
    }

    if (!popup) {
        popup = new ol.Overlay({
            element: document.createElement('div'),
            positioning: 'bottom-center',
            stopEvent: false
        });
        popup.getElement().className = 'ol-popup';
        map.addOverlay(popup);

        map.on('pointermove', function(evt) {
            const feature = map.forEachFeatureAtPixel(evt.pixel, function(f) {
                return f;
            });
            
            if (feature) {
                popup.getElement().innerHTML = feature.get('popupContent');
                popup.setPosition(evt.coordinate);
                popup.getElement().style.display = 'block';
            } else {
                popup.getElement().style.display = 'none';
            }
        });
    }
}

// Update BBOX visualization on map
function updateBboxVisualization(bbox) {
    if (!bbox || bbox.length !== 4) return;
    
    if (bboxLayer) {
        map.removeLayer(bboxLayer);
    }
    
    const bboxPolygon = new ol.geom.Polygon([[
        ol.proj.fromLonLat([bbox[0], bbox[1]]),
        ol.proj.fromLonLat([bbox[2], bbox[1]]),
        ol.proj.fromLonLat([bbox[2], bbox[3]]),
        ol.proj.fromLonLat([bbox[0], bbox[3]]),
        ol.proj.fromLonLat([bbox[0], bbox[1]])
    ]]);
    
    const feature = new ol.Feature({
        geometry: bboxPolygon,
        name: 'Filter BBOX'
    });
    
    bboxLayer = new ol.layer.Vector({
        source: new ol.source.Vector({ features: [feature] }),
        name: 'bboxLayer',
        style: new ol.style.Style({
            stroke: new ol.style.Stroke({
                color: 'rgba(0, 0, 255, 0.2)',
                width: 2
            })
        })
    });
    
    map.addLayer(bboxLayer);
}

// Filter sensors by BBOX
function filterSensorsByBbox() {
    const minX = parseFloat(document.getElementById("number11_s").value);
    const minY = parseFloat(document.getElementById("number111_s").value);
    const maxX = parseFloat(document.getElementById("number22_s").value);
    const maxY = parseFloat(document.getElementById("number222_s").value);
    
    if (isNaN(minX) || isNaN(minY) || isNaN(maxX) || isNaN(maxY)) {
        alert("Please enter valid BBOX coordinates");
        return;
    }
    
    currentBbox = [minX, minY, maxX, maxY];
    updateBboxVisualization(currentBbox);
    
    const vectorSource = vectorLayer.getSource();
    vectorSource.clear();
    
    const filteredSensors = [];
    const sensorDropdown = document.getElementById("layer_dropdown_s");
    sensorDropdown.innerHTML = '<option value="" disabled selected>Select a sensor</option>';
    
    sensorList.forEach(sensor => {
        if (sensor.coordinates && 
            sensor.coordinates[0] >= minX && 
            sensor.coordinates[0] <= maxX && 
            sensor.coordinates[1] >= minY && 
            sensor.coordinates[1] <= maxY) {
            
            filteredSensors.push(sensor);
            
            const feature = new ol.Feature({
                geometry: new ol.geom.Point(ol.proj.fromLonLat(sensor.coordinates)),
                id: sensor.id,
                popupContent: `
                    <div class="sensor-popup">
                        <h4>${sensor.name}</h4>
                        <p><strong>Description:</strong> ${sensor.description}</p>
                        <p><strong>Measures:</strong> ${sensor.observedProperty}</p>
                        <p><strong>Type:</strong> ${sensor.sensorType}</p>
                        <p><strong>Time Interval:</strong> ${sensor.timeInterval}</p>
                        <p><strong>Location:</strong> ${sensor.coordinates[1].toFixed(4)}°N, ${sensor.coordinates[0].toFixed(4)}°E</p>
                    </div>
                `
            });
            vectorSource.addFeature(feature);
            
            const option = document.createElement("option");
            option.value = sensor.id;
            option.textContent = `${sensor.name} - ${sensor.description.substring(0, 50)}${sensor.description.length > 50 ? '...' : ''}`;
            sensorDropdown.appendChild(option);
        }
    });
    
    if (filteredSensors.length === 0) {
        alert("No sensors found within the specified bounding box");
    }
}

// Parse time interval string into date and time components
function parseTimeInterval(intervalString) {
    if (!intervalString || typeof intervalString !== 'string' || intervalString.trim() === '') {
        return { startDate: '', startTime: '00:00', endDate: '', endTime: '23:59' };
    }
    
    try {
        const [start, end] = intervalString.split(' ');
        const startDate = new Date(start);
        const endDate = new Date(end);
        
        if (isNaN(startDate.getTime()) ) {
            // Handle IST time format (2023-06-03T20:00:00+0530)
            const istStart = new Date(start.replace(/(\d{2})(\d{2})$/, "$1:$2"));
            const istEnd = new Date(end.replace(/(\d{2})(\d{2})$/, "$1:$2"));
            
            return {
                startDate: istStart.toISOString().split('T')[0],
                startTime: istStart.toTimeString().substring(0, 8),
                endDate: istEnd.toISOString().split('T')[0],
                endTime: istEnd.toTimeString().substring(0, 8)
            };
        }
        
        return {
            startDate: startDate.toISOString().split('T')[0],
            startTime: startDate.toTimeString().substring(0, 8),
            endDate: endDate.toISOString().split('T')[0],
            endTime: endDate.toTimeString().substring(0, 8)
        };
    } catch (e) {
        console.error("Error parsing time interval:", e);
        return { startDate: '', startTime: '00:00', endDate: '', endTime: '23:59' };
    }
}

// Parse SOS GetCapabilities response
function parseSOSCapabilities(xmlText) {
    const parser = new DOMParser();
    xmlDoc_s = parser.parseFromString(xmlText, "text/xml");
    
    if (vectorLayer) {
        vectorLayer.getSource().clear();
    } else {
        initSensorLayer();
    }
    
    sensorList = [];
    const procedures = xmlDoc_s.getElementsByTagName("sos:procedure");
    
    Array.from(procedures).forEach(procedure => {
        const procedureId = procedure.getAttribute("xlink:href");
        if (procedureId) {
            sensorList.push({
                id: procedureId,
                name: procedureId.split(":").pop(),
                description: "",
                coordinates: null,
                observedProperty: "",
                timeInterval: "",
                sensorType: ""
            });
        }
    });
    
    fetchSensorDetails();
}

// Fetch details for all sensors
function fetchSensorDetails() {
    const server = document.getElementById("field1_s").value || document.getElementById("field1_s").placeholder;
    const vectorSource = vectorLayer.getSource();
    let bbox = [Infinity, Infinity, -Infinity, -Infinity];
    let currentIndex = 0;
    
    function processNextSensor() {
        if (currentIndex >= sensorList.length) {
            updateSensorDropdown();
            
            if (bbox[0] !== Infinity) {
                document.getElementById("number11_s").value = bbox[0];
                document.getElementById("number111_s").value = bbox[1];
                document.getElementById("number22_s").value = bbox[2];
                document.getElementById("number222_s").value = bbox[3];
                
                currentBbox = [bbox[0], bbox[1], bbox[2], bbox[3]];
                updateBboxVisualization(currentBbox);
                
                map.getView().fit(ol.proj.transformExtent(bbox, 'EPSG:4326', 'EPSG:3857'), {
                    padding: [50, 50, 50, 50],
                    duration: 1000
                });
            }
            return;
        }
        
        const currentSensor = sensorList[currentIndex];
        const url = `${server}/istsos/ritwik?service=SOS&version=1.0.0&request=DescribeSensor` +
                    `&procedure=${currentSensor.id}` +
                    `&outputFormat=text/xml;subtype="sensorML/1.0.1"`;
        
        fetch(url)
            .then(response => response.ok ? response.text() : Promise.reject(`HTTP error! Status: ${response.status}`))
            .then(text => {
                const xmlDoc = new DOMParser().parseFromString(text, "text/xml");
                
                currentSensor.description = xmlDoc.getElementsByTagName("gml:description")[0]?.textContent || "No description available";
                
                const coordsText = xmlDoc.getElementsByTagName("gml:coordinates")[0]?.textContent;
                if (coordsText) {
                    const [lon, lat] = coordsText.split(",").map(parseFloat);
                    currentSensor.coordinates = [lon, lat];
                    
                    bbox[0] = Math.min(bbox[0], lon);
                    bbox[1] = Math.min(bbox[1], lat);
                    bbox[2] = Math.max(bbox[2], lon);
                    bbox[3] = Math.max(bbox[3], lat);
                    
                    currentSensor.observedProperty = xmlDoc.getElementsByTagName("swe:Quantity")[0]?.getAttribute("definition") || "Unknown";
                    currentSensor.timeInterval = xmlDoc.getElementsByTagName("swe:interval")[0]?.textContent.trim() || "N/A";
                    
                    Array.from(xmlDoc.getElementsByTagName("sml:classifier")).some(c => {
                        if (c.getAttribute("name") === "Sensor Type") {
                            currentSensor.sensorType = c.getElementsByTagName("sml:value")[0]?.textContent || "Unknown";
                            return true;
                        }
                        return false;
                    });
                    
                    vectorSource.addFeature(new ol.Feature({
                        geometry: new ol.geom.Point(ol.proj.fromLonLat([lon, lat])),
                        id: currentSensor.id,
                        popupContent: `
                            <div class="sensor-popup">
                                <h4>${currentSensor.name}</h4>
                                ${formatPopupContent(currentSensor)}
                            </div>
                        `
                    }));
                }
                
                currentIndex++;
                processNextSensor();
            })
            .catch(error => {
                console.error(`Error fetching ${currentSensor.id}:`, error);
                currentSensor.description = "Error loading details";
                currentIndex++;
                processNextSensor();
            });
    }
    
    processNextSensor();
}

// Helper function to format popup content
function formatPopupContent(sensor) {
    return `
        <p><strong>Description:</strong> ${sensor.description}</p>
        <p><strong>Measures:</strong> ${sensor.observedProperty.split(':').pop()}</p>
        <p><strong>Type:</strong> ${sensor.sensorType}</p>
        <p><strong>Time Interval:</strong> ${sensor.timeInterval}</p>
        <p><strong>Location:</strong> ${sensor.coordinates[1].toFixed(4)}°N, ${sensor.coordinates[0].toFixed(4)}°E</p>
    `;
}

// Update sensor dropdown
function updateSensorDropdown() {
    const sensorDropdown = document.getElementById("layer_dropdown_s");
    sensorDropdown.innerHTML = '<option value="" disabled selected>Select a sensor</option>';

    sensorList.forEach(sensor => {
        const option = document.createElement("option");
        option.value = sensor.id;
        option.textContent = `${sensor.name} - ${sensor.description.substring(0, 50)}${sensor.description.length > 50 ? '...' : ''}`;
        sensorDropdown.appendChild(option);
    });

    sensorDropdown.addEventListener('change', function() {
        const selectedSensorId = this.value;
        if (!selectedSensorId) return;
        
        const selectedSensor = sensorList.find(sensor => sensor.id === selectedSensorId);
        if (!selectedSensor) return;
        
        const timeData = parseTimeInterval(selectedSensor.timeInterval);
        
        document.getElementById("number1_s").value = timeData.startDate;
        document.getElementById("number10_s").value = timeData.startTime;
        document.getElementById("number2_s").value = timeData.endDate;
        document.getElementById("number20_s").value = timeData.endTime;
    });
}

// GetCapabilities request
function sosGetCapabilities() {
    const server = document.getElementById("field1_s").value || document.getElementById("field1_s").placeholder;
    const url = `${server}/istsos/ritwik?service=SOS&request=GetCapabilities`;
    
    const sensorDropdown = document.getElementById("layer_dropdown_s");
    sensorDropdown.innerHTML = '<option value="" disabled selected>Loading sensors...</option>';
    
    if (vectorLayer) {
        vectorLayer.getSource().clear();
    }
    
    fetch(url)
        .then(response => response.ok ? response.text() : Promise.reject(`HTTP error! Status: ${response.status}`))
        .then(text => {
            document.getElementById('xml-display').innerHTML = `<pre>${escapeHtml(vkbeautify.xml(text, 4))}</pre>`;
            parseSOSCapabilities(text);
        })
        .catch(error => {
            document.getElementById('xml-display').innerHTML = `<h2>Error</h2><pre>${escapeHtml(error.message)}</pre>`;
            sensorDropdown.innerHTML = '<option value="" disabled selected>Error loading sensors</option>';
        });
}

// Fetch sensor observations and display results
function fetchSensorObservation() {
    const server = document.getElementById("field1_s").value || document.getElementById("field1_s").placeholder;
    const selectedSensorId = document.getElementById("layer_dropdown_s").value;
    
    if (!selectedSensorId) {
        alert("Please select a sensor first");
        return;
    }

    const startDate = document.getElementById("number1_s").value;
    const startTime = document.getElementById("number10_s").value;
    const endDate = document.getElementById("number2_s").value;
    const endTime = document.getElementById("number20_s").value;

    if (!startDate || !startTime || !endDate || !endTime) {
        alert("Please specify a valid time range");
        return;
    }

    // Convert local time to UTC by subtracting 5:30 hours (for IST to UTC)
    const adjustToUTC = (dateStr, timeStr) => {
        const localDate = new Date(`${dateStr}T${timeStr}`);
        const utcDate = new Date(localDate.getTime() - (5.5 * 60 * 60 ));
        return utcDate.toISOString().replace('.000Z', 'Z');
    };

    const startDateTime = adjustToUTC(startDate, startTime);
    const endDateTime = adjustToUTC(endDate, endTime);
    
    
    
    const selectedSensor = sensorList.find(sensor => sensor.id === selectedSensorId);
    if (!selectedSensor) return;

    // Extract just the procedure name (after last colon)
    const procedureName = selectedSensor.id.split(':').pop();
    
    currentSelectedSensorId = selectedSensorId;
    vectorLayer.getSource().changed();

    const url = `${server}/istsos/ritwik?request=GetObservation` +
                `&service=SOS&version=1.0.0` +
                `&offering=temporary` +
                `&procedure=${procedureName}` +  // Just the name, not full URI
                `&eventTime=${startDateTime}/${endDateTime}` +
                `&observedProperty=${selectedSensor.observedProperty}` +  // Full URI
                `&responseFormat=text/xml`;
    
    const resultsContainer = document.getElementById("sensor-results");
    resultsContainer.innerHTML = '<div class="loading">Loading sensor data...</div>';

    fetch(url)
        .then(response => {
            if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
            return response.text();
        })
        .then(text => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");

            const valuesNode = xmlDoc.getElementsByTagName("swe:values")[0];
            if (!valuesNode) {
                throw new Error("No sensor data found in response");
            }

            const valuesText = valuesNode.textContent.trim();
            const readings = parseSensorReadings(valuesText);
            displaySensorResults(readings, selectedSensor);
        })
        .catch(error => {
            console.error("Error fetching sensor observations:", error);
            document.getElementById("sensor-results").innerHTML = 
                `<div class="error">Error loading sensor data: ${error.message}</div>`;
        });
}

// Parse sensor readings from response (with timezone adjustment)
function parseSensorReadings(valuesText) {
    const readingPairs = valuesText.split('@');
    const readings = [];

    for (const pair of readingPairs) {
        const [timestamp, value] = pair.split(',');
        if (!timestamp || !value) continue;

        // Convert from server time (+05:30) to local time
        const serverDate = new Date(timestamp);
        const localDate = new Date(serverDate.getTime() + (5.5 * 60 * 60 ));
        
        const date = localDate.toISOString().split('T')[0];
        const time = localDate.toTimeString().substring(0, 8);

        readings.push({
            timestamp: timestamp,
            date: date,
            time: time,
            value: parseFloat(value)
        });
    }

    return readings;
}

// Display results with Google Chart and data table
function displaySensorResults(readings, sensor) {
    const resultsContainer = document.getElementById("sensor-results");
    
    if (readings.length === 0) {
        resultsContainer.innerHTML = '<div class="no-data">No readings found.</div>';
        return;
    }

    resultsContainer.innerHTML = `
        <h3>${sensor.name} (${sensor.observedProperty.split(':').pop()})</h3>
        <div id="google-chart-container" style="width:100%; height:400px;"></div>
        <div id="sensor-data-table" class="table-container"></div>
    `;

    drawGoogleChart(readings, sensor.name);
    createDataTable(readings);
}

// Draw Google Chart
function drawGoogleChart(readings, sensorName) {
    google.charts.load('current', { packages: ['corechart'] });
    google.charts.setOnLoadCallback(() => {
        const data = new google.visualization.DataTable();
        data.addColumn('datetime', 'Time');
        data.addColumn('number', 'Value');

        const chartData = readings.map(r => {
            // Convert back to Date object for chart (using local time)
            const localDate = new Date(r.date + 'T' + r.time);
            return [localDate, r.value];
        });

        data.addRows(chartData);

        const options = {
            title: `${sensorName} - Time Series Data`,
            curveType: 'function',
            legend: { position: 'none' },
            hAxis: {
                title: 'Time',
                format: 'MMM dd, HH:mm'
            },
            vAxis: {
                title: 'Value'
            },
            chartArea: { width: '85%', height: '70%' }
        };

        const chart = new google.visualization.LineChart(
            document.getElementById('google-chart-container')
        );
        chart.draw(data, options);
    });
}

// Create data table
function createDataTable(readings) {
    const tableHtml = `
        <table class="sensor-table">
            <thead>
                <tr>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Value</th>
                </tr>
            </thead>
            <tbody>
                ${readings.map(r => `
                    <tr>
                        <td>${r.date}</td>
                        <td>${r.time}</td>
                        <td>${r.value.toFixed(2)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    document.getElementById('sensor-data-table').innerHTML = tableHtml;
}

// Helper function
function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    initSensorLayer();
    
    document.getElementById("number1_s").type = "date";
    document.getElementById("number2_s").type = "date";
    document.getElementById("number10_s").type = "time";
    document.getElementById("number20_s").type = "time";
    
    document.getElementById('sos-getcapabilities').addEventListener('click', sosGetCapabilities);
    document.getElementById('sos-filter').addEventListener('click', filterSensorsByBbox);
    document.getElementById('sos-submit').addEventListener('click', fetchSensorObservation);
    
    ['number11_s', 'number111_s', 'number22_s', 'number222_s'].forEach(id => {
        document.getElementById(id).addEventListener('change', function() {
            const minX = parseFloat(document.getElementById("number11_s").value);
            const minY = parseFloat(document.getElementById("number111_s").value);
            const maxX = parseFloat(document.getElementById("number22_s").value);
            const maxY = parseFloat(document.getElementById("number222_s").value);
            
            if (!isNaN(minX) && !isNaN(minY) && !isNaN(maxX) && !isNaN(maxY)) {
                updateBboxVisualization([minX, minY, maxX, maxY]);
            }
        });
    });
});