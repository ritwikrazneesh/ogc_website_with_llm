// script3.js - SOS Logic (Full Feature Set)

let xmlDoc_s = null;
let sensorList = [];
let vectorLayer = null;
let popup = null;
let bboxLayer = null;
let currentBbox = null;
let currentSelectedSensorId = null;

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
            const feature = map.forEachFeatureAtPixel(evt.pixel, f => f);
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

function updateBboxVisualization(bbox) {
    if (!bbox || bbox.length !== 4) return;
    
    if (bboxLayer) map.removeLayer(bboxLayer);
    
    const bboxPolygon = new ol.geom.Polygon([[
        ol.proj.fromLonLat([bbox[0], bbox[1]]),
        ol.proj.fromLonLat([bbox[2], bbox[1]]),
        ol.proj.fromLonLat([bbox[2], bbox[3]]),
        ol.proj.fromLonLat([bbox[0], bbox[3]]),
        ol.proj.fromLonLat([bbox[0], bbox[1]])
    ]]);
    
    const feature = new ol.Feature({ geometry: bboxPolygon, name: 'Filter BBOX' });
    bboxLayer = new ol.layer.Vector({
        source: new ol.source.Vector({ features: [feature] }),
        name: 'bboxLayer',
        style: new ol.style.Style({ stroke: new ol.style.Stroke({ color: 'rgba(0, 0, 255, 0.2)', width: 2 }) })
    });
    
    map.addLayer(bboxLayer);
}

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
    
    const sensorDropdown = document.getElementById("layer_dropdown_s");
    sensorDropdown.innerHTML = '<option value="" disabled selected>Select a sensor</option>';
    
    sensorList.forEach(sensor => {
        if (sensor.coordinates && 
            sensor.coordinates[0] >= minX && sensor.coordinates[0] <= maxX && 
            sensor.coordinates[1] >= minY && sensor.coordinates[1] <= maxY) {
            
            const feature = new ol.Feature({
                geometry: new ol.geom.Point(ol.proj.fromLonLat(sensor.coordinates)),
                id: sensor.id,
                popupContent: formatPopupContent(sensor)
            });
            vectorSource.addFeature(feature);
            
            const option = document.createElement("option");
            option.value = sensor.id;
            option.textContent = `${sensor.name} - ${sensor.description.substring(0, 50)}...`;
            sensorDropdown.appendChild(option);
        }
    });
}

function parseTimeInterval(intervalString) {
    if (!intervalString || typeof intervalString !== 'string') return { startDate: '', startTime: '00:00', endDate: '', endTime: '23:59' };
    
    try {
        const [start, end] = intervalString.split(' ');
        const startDate = new Date(start);
        const endDate = new Date(end);
        
        return {
            startDate: startDate.toISOString().split('T')[0],
            startTime: startDate.toTimeString().substring(0, 8),
            endDate: endDate.toISOString().split('T')[0],
            endTime: endDate.toTimeString().substring(0, 8)
        };
    } catch (e) {
        return { startDate: '', startTime: '00:00', endDate: '', endTime: '23:59' };
    }
}

function parseSOSCapabilities(xmlText) {
    const parser = new DOMParser();
    xmlDoc_s = parser.parseFromString(xmlText, "text/xml");
    
    if (vectorLayer) vectorLayer.getSource().clear();
    else initSensorLayer();
    
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

function fetchSensorDetails() {
    const serverInput = document.getElementById("field1_s");
    const server = serverInput.value ? serverInput.value : serverInput.placeholder;
    let currentIndex = 0;
    
    function processNextSensor() {
        if (currentIndex >= sensorList.length) {
            updateSensorDropdown();
            return;
        }
        
        const currentSensor = sensorList[currentIndex];
        const url = `${server}/istsos/ritwik?service=SOS&version=1.0.0&request=DescribeSensor&procedure=${currentSensor.id}&outputFormat=text/xml;subtype="sensorML/1.0.1"`;
        
        fetch(url)
            .then(res => res.text())
            .then(text => {
                const xmlDoc = new DOMParser().parseFromString(text, "text/xml");
                currentSensor.description = xmlDoc.getElementsByTagName("gml:description")[0]?.textContent || "No description";
                
                const coordsText = xmlDoc.getElementsByTagName("gml:coordinates")[0]?.textContent;
                if (coordsText) {
                    const [lon, lat] = coordsText.split(",").map(parseFloat);
                    currentSensor.coordinates = [lon, lat];
                    
                    currentSensor.observedProperty = xmlDoc.getElementsByTagName("swe:Quantity")[0]?.getAttribute("definition") || "Unknown";
                    currentSensor.timeInterval = xmlDoc.getElementsByTagName("swe:interval")[0]?.textContent.trim() || "N/A";
                    
                    const feature = new ol.Feature({
                        geometry: new ol.geom.Point(ol.proj.fromLonLat([lon, lat])),
                        id: currentSensor.id,
                        popupContent: formatPopupContent(currentSensor)
                    });
                    vectorLayer.getSource().addFeature(feature);
                }
                currentIndex++;
                processNextSensor();
            })
            .catch(() => {
                currentIndex++;
                processNextSensor();
            });
    }
    processNextSensor();
}

function formatPopupContent(sensor) {
    return `
        <div class="sensor-popup">
            <h4>${sensor.name}</h4>
            <p><strong>Description:</strong> ${sensor.description}</p>
            <p><strong>Measures:</strong> ${sensor.observedProperty.split(':').pop()}</p>
            <p><strong>Location:</strong> ${sensor.coordinates[1].toFixed(4)}°N, ${sensor.coordinates[0].toFixed(4)}°E</p>
        </div>
    `;
}

function updateSensorDropdown() {
    const sensorDropdown = document.getElementById("layer_dropdown_s");
    sensorDropdown.innerHTML = '<option value="" disabled selected>Select a sensor</option>';
    sensorList.forEach(sensor => {
        const option = document.createElement("option");
        option.value = sensor.id;
        option.textContent = `${sensor.name} - ${sensor.description.substring(0, 30)}...`;
        sensorDropdown.appendChild(option);
    });

    sensorDropdown.addEventListener('change', function() {
        const selectedSensor = sensorList.find(s => s.id === this.value);
        if (selectedSensor) {
            const timeData = parseTimeInterval(selectedSensor.timeInterval);
            document.getElementById("number1_s").value = timeData.startDate;
            document.getElementById("number10_s").value = timeData.startTime;
            document.getElementById("number2_s").value = timeData.endDate;
            document.getElementById("number20_s").value = timeData.endTime;
        }
    });
}

function sosGetCapabilities() {
    const serverInput = document.getElementById("field1_s");
    const server = serverInput.value ? serverInput.value : serverInput.placeholder;
    const url = `${server}/istsos/ritwik?service=SOS&request=GetCapabilities`;
    
    // CRITICAL FOR AI: Clear dropdown first
    document.getElementById("layer_dropdown_s").innerHTML = "";
    
    fetch(url)
        .then(res => res.text())
        .then(text => {
            document.getElementById('xml-display').innerHTML = `<pre>${escapeHtml(vkbeautify.xml(text, 4))}</pre>`;
            parseSOSCapabilities(text);
        });
}

function fetchSensorObservation() {
    const serverInput = document.getElementById("field1_s");
    const server = serverInput.value ? serverInput.value : serverInput.placeholder;
    const selectedSensorId = document.getElementById("layer_dropdown_s").value;
    
    if (!selectedSensorId) { alert("Please select a sensor"); return; }

    const startDate = document.getElementById("number1_s").value;
    const startTime = document.getElementById("number10_s").value;
    const endDate = document.getElementById("number2_s").value;
    const endTime = document.getElementById("number20_s").value;
    
    // Construct UTC Times
    const startDateTime = new Date(`${startDate}T${startTime}`).toISOString();
    const endDateTime = new Date(`${endDate}T${endTime}`).toISOString();
    
    const selectedSensor = sensorList.find(s => s.id === selectedSensorId);
    const procedureName = selectedSensor.id.split(':').pop();

    const url = `${server}/istsos/ritwik?request=GetObservation&service=SOS&version=1.0.0&offering=temporary&procedure=${procedureName}&eventTime=${startDateTime}/${endDateTime}&observedProperty=${selectedSensor.observedProperty}&responseFormat=text/xml`;
    
    fetch(url)
        .then(res => res.text())
        .then(text => {
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, "text/xml");
            const valuesNode = xml.getElementsByTagName("swe:values")[0];
            if (!valuesNode) return;
            
            const readings = parseSensorReadings(valuesNode.textContent.trim());
            displaySensorResults(readings, selectedSensor);
        });
}

function parseSensorReadings(valuesText) {
    return valuesText.split('@').map(pair => {
        const [timestamp, value] = pair.split(',');
        return { 
            timestamp, 
            date: timestamp.split('T')[0], 
            time: timestamp.split('T')[1].split('+')[0], 
            value: parseFloat(value) 
        };
    });
}

function displaySensorResults(readings, sensor) {
    const container = document.getElementById("sensor-results");
    const emptyState = document.getElementById("empty-state");
    const chartContainer = document.getElementById("google-chart-container");
    
    container.style.display = "block"; // Ensure section is visible

    if (readings.length === 0) {
        emptyState.style.display = "flex";
        emptyState.innerHTML = "No readings found for this time range.";
        chartContainer.style.display = "none";
        document.getElementById('sensor-data-table').innerHTML = "";
        return;
    }

    // Data found! Hide empty state, show chart
    emptyState.style.display = "none";
    chartContainer.style.display = "block";

    // Update Header
    const header = container.querySelector("h3") || document.createElement("h3");
    header.innerText = `${sensor.name} Analysis`;
    if(!container.querySelector("h3")) container.prepend(header);

    drawGoogleChart(readings, sensor.name);
    createDataTable(readings);
}

function drawGoogleChart(readings, title) {
    google.charts.load('current', { packages: ['corechart'] });
    google.charts.setOnLoadCallback(() => {
        const data = new google.visualization.DataTable();
        data.addColumn('datetime', 'Time');
        data.addColumn('number', 'Value');
        data.addRows(readings.map(r => [new Date(r.timestamp), r.value]));
        
        new google.visualization.LineChart(document.getElementById('google-chart-container')).draw(data, { title });
    });
}

function createDataTable(readings) {
    const rows = readings.map(r => `<tr><td>${r.date}</td><td>${r.time}</td><td>${r.value}</td></tr>`).join('');
    document.getElementById('sensor-data-table').innerHTML = `<table><thead><tr><th>Date</th><th>Time</th><th>Value</th></tr></thead><tbody>${rows}</tbody></table>`;
}

// Init
// ... (rest of the file remains the same)

// Init
// ... (Keep all the functions above this line) ...

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    initSensorLayer();
    
    // SAFEGUARDS: We check if elements exist before adding listeners
    
    const sosGetCaps = document.getElementById('sos-getcapabilities');
    if (sosGetCaps) {
        sosGetCaps.addEventListener('click', sosGetCapabilities);
    }

    // This was the cause of the error! 
    // We removed 'sos-filter' from HTML, so we must remove the listener here.
    const sosFilterBtn = document.getElementById('sos-filter');
    if (sosFilterBtn) {
        sosFilterBtn.addEventListener('click', filterSensorsByBbox);
    }

    const sosSubmit = document.getElementById('sos-submit');
    if (sosSubmit) {
        sosSubmit.addEventListener('click', fetchSensorObservation);
    }
    
    // Set input types safely
    const setType = (id, type) => {
        const el = document.getElementById(id);
        if (el) el.type = type;
    };
    
    setType("number1_s", "date");
    setType("number2_s", "date");
    setType("number10_s", "time");
    setType("number20_s", "time");
    
    // BBOX Change Listeners
    ['number11_s', 'number111_s', 'number22_s', 'number222_s'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', function() {
                const minX = parseFloat(document.getElementById("number11_s").value);
                const minY = parseFloat(document.getElementById("number111_s").value);
                const maxX = parseFloat(document.getElementById("number22_s").value);
                const maxY = parseFloat(document.getElementById("number222_s").value);
                
                if (!isNaN(minX) && !isNaN(minY) && !isNaN(maxX) && !isNaN(maxY)) {
                    updateBboxVisualization([minX, minY, maxX, maxY]);
                }
            });
        }
    });
});