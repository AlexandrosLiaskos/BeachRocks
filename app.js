/**
 * Beach Rocks Web Map - Frontend Application
 * Handles map visualization, filtering, and user interactions for beachrock data
 */

class BeachRockMapApp {
    constructor() {
        this.map = null;
        this.beachrockLayer = null;
        this.markerCluster = null;
        this.currentData = [];
        this.filterOptions = {};
        this.isLoading = false;
        this.filterDebounceTimer = null;
        this.filterUpdateTimer = null;
        this.isUpdatingFilters = false;
        this.beachrockDetailsCache = new Map();
        this.modalElements = null;
        this.popupTemplate = null;
        this.filterOptionsCache = null;
        this.filterOptionsCacheTimestamp = null;
        this.FILTER_CACHE_TTL = 5 * 60 * 1000;
        
        this.init();
    }
    
    async init() {
        this.cacheModalElements();
        this.initMap();
        this.initEventListeners();
        await this.checkDatabaseConnection();
        await this.loadFilterOptions();
        await this.loadStats({});
        await this.loadBeachrockData();
    }
    
    initMap() {
        // Global view centered on world
        this.map = L.map('map', {
            preferCanvas: false,
            zoomControl: true,
            attributionControl: true,
            renderer: L.svg({ padding: 0.5 }),
            zoomAnimation: true,
            zoomAnimationThreshold: 4,
            fadeAnimation: true,
            markerZoomAnimation: true
        }).setView([25, 0], 2);
        
        const baseMaps = {
            "OpenStreetMap": L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19
            }),
            "OpenTopoMap": L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenTopoMap contributors',
                maxZoom: 17
            }),
            "Satellite (ESRI)": L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
                attribution: '© Esri',
                maxZoom: 19
            }),
            "CartoDB Positron": L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
                attribution: '© OpenStreetMap, © CartoDB',
                maxZoom: 19
            }),
            "CartoDB Dark": L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                attribution: '© OpenStreetMap, © CartoDB',
                maxZoom: 19
            })
        };
        
        baseMaps["OpenStreetMap"].addTo(this.map);
        
        L.control.layers(baseMaps, null, {
            position: 'topright',
            collapsed: true
        }).addTo(this.map);
        
        L.control.scale({
            position: 'bottomleft',
            metric: true,
            imperial: false,
            maxWidth: 150
        }).addTo(this.map);
        
        this.addNorthArrow();

        if (typeof MeasurementTool !== 'undefined') {
            this.measurementTool = new MeasurementTool(this.map);
        }
        
        this.markerCluster = L.markerClusterGroup({
            chunkedLoading: true,
            spiderfyOnMaxZoom: false,
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            maxClusterRadius: 40,
            disableClusteringAtZoom: 11,
            animate: false,
            animateAddingMarkers: false,
            removeOutsideVisibleBounds: false,
            iconCreateFunction: function(cluster) {
                const count = cluster.getChildCount();
                return new L.DivIcon({
                    html: '<div style="background: #000; color: #fff; border: 2px solid #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.3); border-radius: 50%; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 600; font-family: Inter, sans-serif;">' + count + '</div>',
                    className: 'minimal-cluster',
                    iconSize: new L.Point(36, 36)
                });
            }
        });
        
        this.map.addLayer(this.markerCluster);
    }
    
    initEventListeners() {
        // Tab navigation
        if (window.innerWidth > 768) {
            const tabButtons = document.querySelectorAll('.tab-button');
            const tabContents = document.querySelectorAll('.tab-content');
            
            tabButtons.forEach(button => {
                button.addEventListener('click', () => {
                    tabButtons.forEach(btn => btn.classList.remove('active'));
                    tabContents.forEach(content => content.classList.remove('active'));
                    button.classList.add('active');
                    const tabId = button.dataset.tab + '-tab';
                    document.getElementById(tabId).classList.add('active');
                });
            });
        }
        
        // Filter change handler
        const handleFilterChange = async () => {
            if (this.isUpdatingFilters) return;
            this.isUpdatingFilters = true;

            const selectedFilters = {
                country: document.getElementById('country-filter').value,
                ocean: document.getElementById('ocean-filter').value,
                cement: document.getElementById('cement-filter').value,
                process: document.getElementById('process-filter').value,
                location: document.getElementById('location-filter').value,
                dating: document.getElementById('dating-filter').value
            };
            
            try {
                await this.loadFilterOptions(selectedFilters);
                this.applyFilters();
            } finally {
                this.isUpdatingFilters = false;
            }
        };

        this.handleFilterChange = handleFilterChange;
        
        // Attach filter listeners
        document.getElementById('country-filter').addEventListener('change', handleFilterChange);
        document.getElementById('ocean-filter').addEventListener('change', handleFilterChange);
        document.getElementById('cement-filter').addEventListener('change', handleFilterChange);
        document.getElementById('process-filter').addEventListener('change', handleFilterChange);
        document.getElementById('location-filter').addEventListener('change', handleFilterChange);
        document.getElementById('dating-filter').addEventListener('change', handleFilterChange);
        
        document.getElementById('clear-filters').addEventListener('click', () => {
            this.clearFilters();
        });
        
        // Modal controls
        const modal = document.getElementById('beachrock-modal');
        const closeBtn = document.querySelector('.close');
        
        closeBtn.addEventListener('click', () => this.closeModal());
        
        document.addEventListener('click', (event) => {
            if (event.target === modal) {
                this.closeModal();
            }
        });
        
        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape' && modal.classList.contains('active')) {
                this.closeModal();
            }
        });
        
        // Welcome modal
        const welcomeModal = document.getElementById('welcome-modal');
        const closeWelcome = document.getElementById('close-welcome');
        const enterWebGIS = document.getElementById('enter-webgis');
        const aboutBtn = document.getElementById('about-btn');

        const closeWelcomeModal = () => {
            if (welcomeModal) welcomeModal.classList.remove('active');
        };

        if (welcomeModal) {
            setTimeout(() => welcomeModal.classList.add('active'), 300);
            if (closeWelcome) closeWelcome.addEventListener('click', closeWelcomeModal);
            if (enterWebGIS) enterWebGIS.addEventListener('click', closeWelcomeModal);
            welcomeModal.addEventListener('click', (event) => {
                if (event.target === welcomeModal) closeWelcomeModal();
            });
        }

        if (aboutBtn && welcomeModal) {
            aboutBtn.addEventListener('click', () => welcomeModal.classList.add('active'));
        }

        // References modal
        const referencesBtn = document.getElementById('references-btn');
        const referencesModal = document.getElementById('references-modal');
        const closeReferences = document.getElementById('close-references');

        if (referencesBtn && referencesModal) {
            referencesBtn.addEventListener('click', () => referencesModal.classList.add('active'));
            if (closeReferences) {
                closeReferences.addEventListener('click', () => referencesModal.classList.remove('active'));
            }
            referencesModal.addEventListener('click', (event) => {
                if (event.target === referencesModal) referencesModal.classList.remove('active');
            });
        }

        // Mobile controls
        const mobileFiltersToggle = document.getElementById('mobile-filters-toggle');
        const mobileStatsToggle = document.getElementById('mobile-stats-toggle');
        const sidebar = document.getElementById('sidebar');
        const mobileClose = document.getElementById('mobile-sidebar-close');

        if (mobileFiltersToggle && sidebar) {
            mobileFiltersToggle.addEventListener('click', () => {
                sidebar.classList.toggle('active');
                document.getElementById('filters-tab').classList.add('active');
                document.getElementById('stats-tab').classList.remove('active');
            });
        }

        if (mobileStatsToggle && sidebar) {
            mobileStatsToggle.addEventListener('click', () => {
                sidebar.classList.toggle('active');
                document.getElementById('stats-tab').classList.add('active');
                document.getElementById('filters-tab').classList.remove('active');
            });
        }

        if (mobileClose && sidebar) {
            mobileClose.addEventListener('click', () => sidebar.classList.remove('active'));
        }
    }

    async loadFilterOptions(selectedFilters = {}) {
        if (!window.supabaseClient) {
            console.error('❌ Database connection not initialized.');
            this.showError('Database connection not initialized.');
            return;
        }
        
        try {
            this.showFilterLoading(true);
            
            // Country query
            let countryQuery = window.supabaseClient.from('beachrocks').select('country').not('country', 'is', null);
            if (selectedFilters.ocean) countryQuery = countryQuery.eq('ocean_sea', selectedFilters.ocean);
            if (selectedFilters.cement) countryQuery = countryQuery.eq('cement_type', selectedFilters.cement);
            if (selectedFilters.process) countryQuery = countryQuery.eq('formation_process', selectedFilters.process);
            if (selectedFilters.location) countryQuery = countryQuery.eq('formation_location', selectedFilters.location);
            if (selectedFilters.dating) countryQuery = countryQuery.eq('dating_method', selectedFilters.dating);
            const countryData = await this._fetchAllRecords(countryQuery);
            const countries = this._getUniqueValues(countryData, 'country');
            
            // Ocean/Sea query
            let oceanQuery = window.supabaseClient.from('beachrocks').select('ocean_sea').not('ocean_sea', 'is', null);
            if (selectedFilters.country) oceanQuery = oceanQuery.eq('country', selectedFilters.country);
            if (selectedFilters.cement) oceanQuery = oceanQuery.eq('cement_type', selectedFilters.cement);
            if (selectedFilters.process) oceanQuery = oceanQuery.eq('formation_process', selectedFilters.process);
            if (selectedFilters.location) oceanQuery = oceanQuery.eq('formation_location', selectedFilters.location);
            if (selectedFilters.dating) oceanQuery = oceanQuery.eq('dating_method', selectedFilters.dating);
            const oceanData = await this._fetchAllRecords(oceanQuery);
            const oceans = this._getUniqueValues(oceanData, 'ocean_sea');
            
            // Cement type query
            let cementQuery = window.supabaseClient.from('beachrocks').select('cement_type').not('cement_type', 'is', null);
            if (selectedFilters.country) cementQuery = cementQuery.eq('country', selectedFilters.country);
            if (selectedFilters.ocean) cementQuery = cementQuery.eq('ocean_sea', selectedFilters.ocean);
            if (selectedFilters.process) cementQuery = cementQuery.eq('formation_process', selectedFilters.process);
            if (selectedFilters.location) cementQuery = cementQuery.eq('formation_location', selectedFilters.location);
            if (selectedFilters.dating) cementQuery = cementQuery.eq('dating_method', selectedFilters.dating);
            const cementData = await this._fetchAllRecords(cementQuery);
            const cements = this._getUniqueValues(cementData, 'cement_type');
            
            // Formation process query
            let processQuery = window.supabaseClient.from('beachrocks').select('formation_process').not('formation_process', 'is', null);
            if (selectedFilters.country) processQuery = processQuery.eq('country', selectedFilters.country);
            if (selectedFilters.ocean) processQuery = processQuery.eq('ocean_sea', selectedFilters.ocean);
            if (selectedFilters.cement) processQuery = processQuery.eq('cement_type', selectedFilters.cement);
            if (selectedFilters.location) processQuery = processQuery.eq('formation_location', selectedFilters.location);
            if (selectedFilters.dating) processQuery = processQuery.eq('dating_method', selectedFilters.dating);
            const processData = await this._fetchAllRecords(processQuery);
            const processes = this._getUniqueValues(processData, 'formation_process');
            
            // Formation location query
            let locationQuery = window.supabaseClient.from('beachrocks').select('formation_location').not('formation_location', 'is', null);
            if (selectedFilters.country) locationQuery = locationQuery.eq('country', selectedFilters.country);
            if (selectedFilters.ocean) locationQuery = locationQuery.eq('ocean_sea', selectedFilters.ocean);
            if (selectedFilters.cement) locationQuery = locationQuery.eq('cement_type', selectedFilters.cement);
            if (selectedFilters.process) locationQuery = locationQuery.eq('formation_process', selectedFilters.process);
            if (selectedFilters.dating) locationQuery = locationQuery.eq('dating_method', selectedFilters.dating);
            const locationData = await this._fetchAllRecords(locationQuery);
            const locations = this._getUniqueValues(locationData, 'formation_location');
            
            // Dating method query
            let datingQuery = window.supabaseClient.from('beachrocks').select('dating_method').not('dating_method', 'is', null);
            if (selectedFilters.country) datingQuery = datingQuery.eq('country', selectedFilters.country);
            if (selectedFilters.ocean) datingQuery = datingQuery.eq('ocean_sea', selectedFilters.ocean);
            if (selectedFilters.cement) datingQuery = datingQuery.eq('cement_type', selectedFilters.cement);
            if (selectedFilters.process) datingQuery = datingQuery.eq('formation_process', selectedFilters.process);
            if (selectedFilters.location) datingQuery = datingQuery.eq('formation_location', selectedFilters.location);
            const datingData = await this._fetchAllRecords(datingQuery);
            const datings = this._getUniqueValues(datingData, 'dating_method');
            
            this.filterOptions = { countries, oceans, cements, processes, locations, datings };
            this.populateFilterDropdowns(selectedFilters);
            this.showFilterLoading(false);
            
        } catch (error) {
            console.error('❌ Error loading filter options:', error);
            this.showFilterLoading(false);
            this.showError('Failed to load filter options.');
        }
    }
    
    _getUniqueValues(data, fieldName) {
        const uniqueValues = new Set();
        data.forEach(item => {
            const value = item[fieldName];
            if (value !== null && value !== undefined) {
                const processedValue = typeof value === 'string' ? value.trim() : value;
                if (processedValue !== '') uniqueValues.add(processedValue);
            }
        });
        return Array.from(uniqueValues).sort((a, b) => String(a).localeCompare(String(b)));
    }
    
    async _fetchAllRecords(query) {
        const allRecords = [];
        const batchSize = 1000;
        let offset = 0;
        
        while (true) {
            const { data, error } = await query.range(offset, offset + batchSize - 1);
            if (error) throw error;
            if (!data || data.length === 0) break;
            allRecords.push(...data);
            if (data.length < batchSize) break;
            offset += batchSize;
        }
        return allRecords;
    }
    
    populateFilterDropdowns(selectedFilters = {}) {
        this.populateDropdown('country', this.filterOptions.countries, selectedFilters.country);
        this.populateDropdown('ocean', this.filterOptions.oceans, selectedFilters.ocean);
        this.populateDropdown('cement', this.filterOptions.cements, selectedFilters.cement);
        this.populateDropdown('process', this.filterOptions.processes, selectedFilters.process);
        this.populateDropdown('location', this.filterOptions.locations, selectedFilters.location);
        this.populateDropdown('dating', this.filterOptions.datings, selectedFilters.dating);
    }
    
    populateDropdown(filterName, options, currentValue) {
        const select = document.getElementById(`${filterName}-filter`);
        if (!select) return;

        while (select.options.length > 1) select.remove(1);

        options.forEach(value => {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            select.appendChild(option);
        });

        if (currentValue) {
            select.value = currentValue;
            select.classList.add('has-value');
        } else {
            select.value = '';
            select.classList.remove('has-value');
        }

        if (window.refreshDropdown) window.refreshDropdown(`${filterName}-filter`);
    }
    
    async loadStats(filters = {}) {
        try {
            // Total count
            const { count: totalCount } = await window.supabaseClient.from('beachrocks').select('*', { count: 'exact', head: true });
            
            // Countries count
            const { data: countryData } = await window.supabaseClient.from('beachrocks').select('country').not('country', 'is', null);
            const countries = new Set(countryData.map(p => p.country)).size;
            
            // Oceans/Seas count
            const { data: oceanData } = await window.supabaseClient.from('beachrocks').select('ocean_sea').not('ocean_sea', 'is', null);
            const oceans = new Set(oceanData.map(p => p.ocean_sea)).size;
            
            // Cement types count
            const { data: cementData } = await window.supabaseClient.from('beachrocks').select('cement_type').not('cement_type', 'is', null);
            const cementTypes = new Set(cementData.map(p => p.cement_type)).size;
            
            document.getElementById('total-beachrocks').textContent = totalCount.toLocaleString();
            document.getElementById('total-countries').textContent = countries.toLocaleString();
            document.getElementById('total-oceans').textContent = oceans.toLocaleString();
            document.getElementById('total-cement-types').textContent = cementTypes.toLocaleString();
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
    
    async loadBeachrockData(filters = {}) {
        if (this.isLoading) return;
        
        this.showLoading(true);
        this.isLoading = true;
        
        try {
            let query = window.supabaseClient.from('beachrocks')
                .select('id, latitude, longitude, site, area, country, ocean_sea, cement_type, formation_process, formation_location, dating_method, estimated_age')
                .not('latitude', 'is', null)
                .not('longitude', 'is', null);

            if (filters.country) query = query.eq('country', filters.country);
            if (filters.ocean) query = query.eq('ocean_sea', filters.ocean);
            if (filters.cement) query = query.eq('cement_type', filters.cement);
            if (filters.process) query = query.eq('formation_process', filters.process);
            if (filters.location) query = query.eq('formation_location', filters.location);
            if (filters.dating) query = query.eq('dating_method', filters.dating);
            
            query = query.limit(1000);
            
            const { data, error } = await query;
            if (error) throw error;
            
            console.log(`✅ Loaded ${data.length} beachrocks`);
            this.currentData = data;
            this.updateMap();
            this.updateVisiblePointsCount();
            
        } catch (error) {
            console.error('❌ Error loading beachrock data:', error);
            this.showError('Failed to load beachrock data.');
        } finally {
            this.showLoading(false);
            this.isLoading = false;
        }
    }
    
    updateMap() {
        this.markerCluster.clearLayers();
        
        const markers = this.currentData.map(beachrock => {
            const marker = L.circleMarker([beachrock.latitude, beachrock.longitude], {
                radius: 10,
                fillColor: this.getMarkerColor(beachrock),
                color: '#000000',
                weight: 2,
                opacity: 1,
                fillOpacity: 0.95,
                renderer: L.svg(),
                bubblingMouseEvents: false,
                pane: 'markerPane'
            });
            
            const clickArea = L.circleMarker([beachrock.latitude, beachrock.longitude], {
                radius: 16,
                fillColor: 'transparent',
                color: 'transparent',
                weight: 0,
                fillOpacity: 0,
                interactive: true,
                bubblingMouseEvents: false
            });
            
            marker.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                this.showBeachrockDetails(beachrock.id);
            });
            
            clickArea.on('click', (e) => {
                L.DomEvent.stopPropagation(e);
                this.showBeachrockDetails(beachrock.id);
            });
            
            const tooltipContent = `
                <div style="font-size: 12px; padding: 6px; line-height: 1.4;">
                    <strong style="font-size: 13px;">${this.escapeHtml(beachrock.site || 'Unknown Site')}</strong><br>
                    <span style="color: #666;">Country:</span> <strong>${this.escapeHtml(beachrock.country || 'N/A')}</strong><br>
                    <span style="color: #666;">Ocean/Sea:</span> ${beachrock.ocean_sea || 'N/A'}<br>
                    <span style="color: #666;">Cement:</span> ${beachrock.cement_type || 'N/A'}
                </div>
            `;
            
            marker.bindTooltip(tooltipContent, {
                direction: 'top',
                offset: [0, -10],
                opacity: 0.9,
                className: 'minimal-tooltip'
            });
            
            clickArea.on('mouseover', () => {
                marker.setStyle({ weight: 3, fillOpacity: 1 });
                marker.openTooltip();
            });
            clickArea.on('mouseout', () => {
                marker.setStyle({ weight: 2, fillOpacity: 0.95 });
                marker.closeTooltip();
            });
            marker.on('mouseover', () => marker.setStyle({ weight: 3, fillOpacity: 1 }));
            marker.on('mouseout', () => marker.setStyle({ weight: 2, fillOpacity: 0.95 }));
            
            return L.layerGroup([marker, clickArea]);
        });
        
        if (markers.length > 0) {
            this.markerCluster.addLayers(markers);
            const bounds = this.markerCluster.getBounds();
            if (bounds.isValid()) this.map.fitBounds(bounds.pad(0.05));
        }
        
        this.updateVisiblePointsCount();
    }
    
    getMarkerColor(beachrock) {
        // Color based on ocean/sea
        const oceanColors = {
            'Mediterranean Sea': '#0066cc',
            'Aegean Sea': '#3399ff',
            'Atlantic Ocean': '#003366',
            'Pacific Ocean': '#006699',
            'Indian Ocean': '#009999',
            'Caribbean Sea': '#00cccc',
            'Red Sea': '#cc3300',
            'Persian Gulf': '#ff6600',
            'Ionian Sea': '#6699cc',
            'Black Sea': '#333333',
            'Lake': '#66cc66'
        };
        return oceanColors[beachrock.ocean_sea] || '#000000';
    }
    
    async showBeachrockDetails(beachrockId) {
        if (this.beachrockDetailsCache.has(beachrockId)) {
            this.displayBeachrockModal(this.beachrockDetailsCache.get(beachrockId));
            return;
        }
        
        try {
            const { data: beachrock, error } = await window.supabaseClient
                .from('beachrocks')
                .select('*')
                .eq('id', beachrockId)
                .single();
            if (error) throw error;
            
            beachrock.dataset_reference = 'https://doi.org/10.5281/zenodo.16408107';
            this.beachrockDetailsCache.set(beachrockId, beachrock);
            this.displayBeachrockModal(beachrock);
        } catch (error) {
            console.error('Error loading beachrock details:', error);
            this.showError('Failed to load beachrock details.');
        }
    }
    
    displayBeachrockModal(beachrock) {
        if (!this.modalElements) this.cacheModalElements();
        
        const fields = [
            { key: 'id', label: 'ID', highlight: true },
            { key: 'site', label: 'Site' },
            { key: 'area', label: 'Area' },
            { key: 'country', label: 'Country' },
            { key: 'ocean_sea', label: 'Ocean / Sea' },
            { key: 'latitude', label: 'Latitude' },
            { key: 'longitude', label: 'Longitude' },
            { key: 'pos_type', label: 'Position Type' },
            { key: 'maximum_altitude', label: 'Maximum Altitude' },
            { key: 'minimum_altitude', label: 'Minimum Altitude' },
            { key: 'no_of_slabs', label: 'Number of Slabs' },
            { key: 'tidal_range', label: 'Tidal Range' },
            { key: 'dating_method', label: 'Dating Method' },
            { key: 'dated_sample', label: 'Dated Sample' },
            { key: 'estimated_age', label: 'Estimated Age' },
            { key: 'main_composition', label: 'Main Composition' },
            { key: 'cement_type', label: 'Cement Type' },
            { key: 'cement_microstructure', label: 'Cement Microstructure' },
            { key: 'formation_process', label: 'Formation Process' },
            { key: 'formation_location', label: 'Formation Location' },
            { key: 'water_table', label: 'Water Table' },
            { key: 'reference', label: 'Reference' },
            { key: 'publication_year', label: 'Publication Year' },
            { key: 'dataset_reference', label: 'Dataset Reference', isLink: true }
        ];
        
        let html = '';
        fields.forEach(field => {
            const value = beachrock[field.key];
            const displayValue = value !== null && value !== undefined && value.toString().trim() ? value : '-';
            const highlightClass = field.highlight ? 'detail-item-highlighted' : '';
            
            let valueHtml;
            if (field.isLink && value && value.toString().trim() && value !== '-') {
                valueHtml = `<a href="${this.escapeHtml(value)}" target="_blank" rel="noopener noreferrer" style="color: #0066ff; text-decoration: underline;">${this.escapeHtml(value)}</a>`;
            } else if (field.key === 'id') {
                valueHtml = `#${displayValue}`;
            } else {
                valueHtml = this.escapeHtml(String(displayValue));
            }
            
            html += `
                <div class="detail-item ${highlightClass}">
                    <div class="detail-label">${field.label}</div>
                    <div class="detail-value">${valueHtml}</div>
                </div>
            `;
        });
        
        this.modalElements.detailsContainer.innerHTML = html;
        this.modalElements.modal.classList.add('active');
        document.body.classList.add('modal-open');
    }
    
    async applyFilters() {
        const filters = {
            country: document.getElementById('country-filter').value,
            ocean: document.getElementById('ocean-filter').value,
            cement: document.getElementById('cement-filter').value,
            process: document.getElementById('process-filter').value,
            location: document.getElementById('location-filter').value,
            dating: document.getElementById('dating-filter').value
        };
        
        let activeCount = 0;
        Object.keys(filters).forEach(key => {
            if (!filters[key]) delete filters[key];
            else activeCount++;
        });
        
        this.updateActiveFiltersDisplay(filters);
        this.updateFilterIndicator(activeCount, filters);
        
        if (window.innerWidth <= 768) {
            const sidebar = document.getElementById('sidebar');
            if (sidebar) sidebar.classList.remove('active');
        }
        
        await this.loadBeachrockData(filters);
        await this.loadStats(filters);
    }
    
    updateFilterIndicator(count, filters = {}) {
        const toggleBtn = document.getElementById('mobile-filters-toggle');
        if (!toggleBtn) return;
        
        if (count > 0) {
            toggleBtn.textContent = `Filters (${count})`;
            toggleBtn.style.borderColor = 'var(--accent-blue)';
        } else {
            toggleBtn.textContent = 'Filters';
            toggleBtn.style.borderColor = '';
        }
    }
    
    async checkDatabaseConnection() {
        if (!window.supabaseClient) {
            this.showError('Database connection not initialized.');
            return false;
        }
        
        try {
            const { count, error } = await window.supabaseClient
                .from('beachrocks')
                .select('*', { count: 'exact', head: true });
            
            if (error) {
                this.showError('Failed to connect to database.');
                return false;
            }
            
            console.log(`✅ Database connected. ${count} beachrocks found.`);
            return true;
        } catch (error) {
            this.showError('Database connection error.');
            return false;
        }
    }
    
    showFilterLoading(show) {
        const filterLoading = document.getElementById('filter-loading');
        if (filterLoading) {
            filterLoading.classList.toggle('hidden', !show);
        }
    }
    
    async clearFilters() {
        const filterIds = ['country-filter', 'ocean-filter', 'cement-filter', 'process-filter', 'location-filter', 'dating-filter'];
        filterIds.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.value = '';
                el.classList.remove('has-value');
            }
        });
        
        const summary = document.getElementById('active-filters-summary');
        if (summary) summary.classList.add('hidden');
        
        await this.loadFilterOptions({});
        this.updateFilterIndicator(0, {});
        this.applyFilters();
    }
    
    updateActiveFiltersDisplay(filters) {
        const summary = document.getElementById('active-filters-summary');
        const list = document.getElementById('active-filters-list');
        if (!summary || !list) return;
        
        list.innerHTML = '';
        
        const labels = {
            country: 'Country',
            ocean: 'Ocean/Sea',
            cement: 'Cement Type',
            process: 'Formation Process',
            location: 'Formation Location',
            dating: 'Dating Method'
        };
        
        const activeCount = Object.keys(filters).length;
        if (activeCount === 0) {
            summary.classList.add('hidden');
            return;
        }
        
        summary.classList.remove('hidden');
        
        Object.keys(filters).forEach(key => {
            const badge = document.createElement('div');
            badge.className = 'filter-badge';
            badge.innerHTML = `
                <span class="filter-badge-label">${labels[key] || key}:</span>
                <span class="filter-badge-value">${this.escapeHtml(filters[key])}</span>
                <button class="filter-badge-remove" title="Remove filter">×</button>
            `;
            badge.querySelector('.filter-badge-remove').addEventListener('click', () => this.clearIndividualFilter(key));
            list.appendChild(badge);
        });
    }
    
    async clearIndividualFilter(filterName) {
        const filterIds = {
            country: 'country-filter',
            ocean: 'ocean-filter',
            cement: 'cement-filter',
            process: 'process-filter',
            location: 'location-filter',
            dating: 'dating-filter'
        };
        
        const el = document.getElementById(filterIds[filterName]);
        if (el) {
            el.value = '';
            el.classList.remove('has-value');
        }
        this.applyFilters();
    }
    
    updateVisiblePointsCount() {
        document.getElementById('visible-points').textContent = this.currentData.length.toLocaleString();
    }
    
    showLoading(show) {
        const loading = document.getElementById('loading');
        if (loading) loading.classList.toggle('hidden', !show);
    }
    
    showError(message) {
        console.error('Error:', message);
        let errorBanner = document.getElementById('error-banner');
        if (errorBanner) {
            const msgEl = document.getElementById('error-banner-message');
            if (msgEl) msgEl.textContent = message;
            errorBanner.classList.remove('hidden');
        }
    }
    
    closeModal() {
        if (this.modalElements && this.modalElements.modal) {
            this.modalElements.modal.classList.remove('active');
        }
        document.body.classList.remove('modal-open');
    }
    
    cacheModalElements() {
        this.modalElements = {
            modal: document.getElementById('beachrock-modal'),
            detailsContainer: document.getElementById('beachrock-details')
        };
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    addNorthArrow() {
        const NorthArrowControl = L.Control.extend({
            options: { position: 'topleft' },
            onAdd: function(map) {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control north-arrow-control');
                container.innerHTML = `
                    <div style="background: white; padding: 5px; border-radius: 4px; box-shadow: 0 1px 5px rgba(0,0,0,0.3); text-align: center;">
                        <div style="font-size: 20px; font-weight: bold; color: #333;">↑</div>
                        <div style="font-size: 10px; font-weight: bold; color: #333;">N</div>
                    </div>
                `;
                return container;
            }
        });
        this.map.addControl(new NorthArrowControl());
    }
}

// Initialize app
const app = new BeachRockMapApp();
