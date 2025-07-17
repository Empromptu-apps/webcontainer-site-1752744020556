import React, { useState, useRef } from 'react';

const CustomerSupportAnalyzer = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [csvFile, setCsvFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [analysisResults, setAnalysisResults] = useState({
    summary: {},
    tickets: [],
    templates: []
  });
  const [loadingStates, setLoadingStates] = useState({
    ingestion: false,
    sentiment: false,
    categorization: false,
    escalation: false,
    templates: false,
    summary: false,
    ticketAnalysis: false
  });
  const [completedSteps, setCompletedSteps] = useState({
    ingestion: false,
    sentiment: false,
    categorization: false,
    escalation: false,
    templates: false,
    summary: false,
    ticketAnalysis: false
  });
  const [error, setError] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [apiLogs, setApiLogs] = useState([]);
  const [showRawData, setShowRawData] = useState(false);
  const [rawApiData, setRawApiData] = useState(null);
  const fileInputRef = useRef(null);

  const API_BASE = 'https://builder.empromptu.ai/api_tools';
  const API_HEADERS = {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer 4e31d5e989125dc49a09d234c59e85bc',
    'X-Generated-App-ID': '37e8dc84-453a-4f2b-b1f4-69b8034b06d2',
    'X-Usage-Key': 'ccfbd5ba750c00f60be606165b14983f'
  };

  const logApiCall = (endpoint, method, payload, response) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      endpoint,
      method,
      payload,
      response,
      id: Date.now()
    };
    setApiLogs(prev => [...prev, logEntry]);
  };

  const updateLoadingState = (step, isLoading) => {
    setLoadingStates(prev => ({ ...prev, [step]: isLoading }));
  };

  const markStepCompleted = (step) => {
    setCompletedSteps(prev => ({ ...prev, [step]: true }));
    updateLoadingState(step, false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.currentTarget.classList.add('drag-over');
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.currentTarget.classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const handleFileSelection = (file) => {
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
      setError(null);
      setCurrentStep(2);
    } else {
      setError('Please upload a valid CSV file');
    }
  };

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      handleFileSelection(file);
    }
  };

  const processAnalysis = async () => {
    if (!csvFile) return;

    setIsProcessing(true);
    setCurrentStep(3); // Show the report immediately
    setError(null);
    setApiLogs([]);
    
    // Reset all states
    setLoadingStates({
      ingestion: false,
      sentiment: false,
      categorization: false,
      escalation: false,
      templates: false,
      summary: false,
      ticketAnalysis: false
    });
    setCompletedSteps({
      ingestion: false,
      sentiment: false,
      categorization: false,
      escalation: false,
      templates: false,
      summary: false,
      ticketAnalysis: false
    });

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const csvContent = e.target.result;

        // Step 1: Upload CSV data
        updateLoadingState('ingestion', true);
        const ingestPayload = {
          created_object_name: 'support_tickets',
          data_type: 'strings',
          input_data: [csvContent]
        };

        const ingestResponse = await fetch(`${API_BASE}/input_data`, {
          method: 'POST',
          headers: API_HEADERS,
          body: JSON.stringify(ingestPayload)
        });
        const ingestResult = await ingestResponse.json();
        logApiCall('/input_data', 'POST', ingestPayload, ingestResult);
        markStepCompleted('ingestion');

        // Step 2: Sentiment Analysis
        updateLoadingState('sentiment', true);
        const sentimentPayload = {
          created_object_names: ['sentiment_analysis'],
          prompt_string: `Analyze the sentiment of each support ticket description in this CSV data: {support_tickets}
          
          For each ticket, determine:
          - Sentiment (Positive/Neutral/Negative/Very Negative)
          - Emotion indicators (frustrated, angry, confused, satisfied, etc.)
          - Urgency level based on language used
          - Key trigger words found (cancel, refund, manager, urgent, etc.)
          
          Return as JSON array with ticket_id, sentiment, emotion, urgency, trigger_words for each ticket.`,
          inputs: [{ input_object_name: 'support_tickets', mode: 'combine_events' }]
        };

        const sentimentResponse = await fetch(`${API_BASE}/apply_prompt`, {
          method: 'POST',
          headers: API_HEADERS,
          body: JSON.stringify(sentimentPayload)
        });
        const sentimentResult = await sentimentResponse.json();
        logApiCall('/apply_prompt', 'POST', sentimentPayload, sentimentResult);
        markStepCompleted('sentiment');

        // Step 3: Category Validation & Auto-categorization
        updateLoadingState('categorization', true);
        const categoryPayload = {
          created_object_names: ['category_analysis'],
          prompt_string: `Analyze the categorization accuracy of support tickets: {support_tickets}
          
          For each ticket:
          1. Validate if current category matches the description content
          2. Suggest better category if miscategorized
          3. Identify emerging issue patterns not covered by existing categories
          4. Flag tickets that might need multiple categories
          
          Return as JSON with ticket_id, current_category, suggested_category, confidence_score, reasoning.`,
          inputs: [{ input_object_name: 'support_tickets', mode: 'combine_events' }]
        };

        const categoryResponse = await fetch(`${API_BASE}/apply_prompt`, {
          method: 'POST',
          headers: API_HEADERS,
          body: JSON.stringify(categoryPayload)
        });
        const categoryResult = await categoryResponse.json();
        logApiCall('/apply_prompt', 'POST', categoryPayload, categoryResult);
        markStepCompleted('categorization');

        // Step 4: Escalation Risk Assessment
        updateLoadingState('escalation', true);
        const escalationPayload = {
          created_object_names: ['escalation_risk'],
          prompt_string: `Calculate escalation risk for each ticket using this data: {support_tickets} and sentiment analysis: {sentiment_analysis}
          
          Risk factors:
          - High/Critical priority + Negative sentiment = HIGH RISK
          - VIP/Premium customers + any negative sentiment = HIGH RISK  
          - Resolution time > 48 hours = MEDIUM RISK
          - Trigger words (cancel, refund, manager) = MEDIUM RISK
          - Multiple tickets from same customer = MEDIUM RISK
          - Low satisfaction scores (<3) = MEDIUM RISK
          
          Return JSON with ticket_id, risk_level (LOW/MEDIUM/HIGH/CRITICAL), risk_factors, recommended_action, priority_score (1-10).`,
          inputs: [
            { input_object_name: 'support_tickets', mode: 'combine_events' },
            { input_object_name: 'sentiment_analysis', mode: 'combine_events' }
          ]
        };

        const escalationResponse = await fetch(`${API_BASE}/apply_prompt`, {
          method: 'POST',
          headers: API_HEADERS,
          body: JSON.stringify(escalationPayload)
        });
        const escalationResult = await escalationResponse.json();
        logApiCall('/apply_prompt', 'POST', escalationPayload, escalationResult);
        markStepCompleted('escalation');

        // Step 5: Generate Response Templates
        updateLoadingState('templates', true);
        const templatesPayload = {
          created_object_names: ['response_templates'],
          prompt_string: `Create personalized response templates based on: {support_tickets}, {sentiment_analysis}, and {category_analysis}
          
          Generate templates for each combination of:
          - Category (Technical, Billing, Product, etc.)
          - Sentiment (Positive, Neutral, Negative, Very Negative)
          - Customer Tier (Standard, Premium, VIP)
          
          Each template should:
          - Use appropriate tone for sentiment level
          - Include customer tier-specific language
          - Have placeholders for [CUSTOMER_NAME], [SPECIFIC_ISSUE], [AGENT_NAME]
          - Provide clear next steps
          - Include escalation language when needed
          
          Return as JSON with category, sentiment, tier, template_text, tone_notes.`,
          inputs: [
            { input_object_name: 'support_tickets', mode: 'combine_events' },
            { input_object_name: 'sentiment_analysis', mode: 'combine_events' },
            { input_object_name: 'category_analysis', mode: 'combine_events' }
          ]
        };

        const templatesResponse = await fetch(`${API_BASE}/apply_prompt`, {
          method: 'POST',
          headers: API_HEADERS,
          body: JSON.stringify(templatesPayload)
        });
        const templatesResult = await templatesResponse.json();
        logApiCall('/apply_prompt', 'POST', templatesPayload, templatesResult);

        // Get templates data immediately
        const templatesDataResponse = await fetch(`${API_BASE}/return_data/response_templates`, { headers: API_HEADERS });
        const templatesData = await templatesDataResponse.json();
        const templates = JSON.parse(templatesData.text_value || '[]');
        
        setAnalysisResults(prev => ({ ...prev, templates }));
        markStepCompleted('templates');

        // Step 6: Executive Summary & Metrics
        updateLoadingState('summary', true);
        const summaryPayload = {
          created_object_names: ['executive_summary'],
          prompt_string: `Create executive summary and key metrics from: {support_tickets}, {sentiment_analysis}, {escalation_risk}
          
          Calculate and provide:
          1. Total tickets, open/closed counts, resolution rate
          2. Average resolution time overall and by priority
          3. Customer satisfaction by tier (VIP/Premium/Standard)
          4. Sentiment distribution (% positive/neutral/negative)
          5. High-risk tickets requiring immediate attention
          6. Agent workload distribution
          7. Top 5 categories by volume
          8. Emerging issue patterns
          9. Daily/weekly trend insights
          10. Escalation alerts and recommended actions
          
          Format as JSON with clear metrics and actionable insights.`,
          inputs: [
            { input_object_name: 'support_tickets', mode: 'combine_events' },
            { input_object_name: 'sentiment_analysis', mode: 'combine_events' },
            { input_object_name: 'escalation_risk', mode: 'combine_events' }
          ]
        };

        const summaryResponse = await fetch(`${API_BASE}/apply_prompt`, {
          method: 'POST',
          headers: API_HEADERS,
          body: JSON.stringify(summaryPayload)
        });
        const summaryResult = await summaryResponse.json();
        logApiCall('/apply_prompt', 'POST', summaryPayload, summaryResult);

        // Get summary data immediately
        const summaryDataResponse = await fetch(`${API_BASE}/return_data/executive_summary`, { headers: API_HEADERS });
        const summaryData = await summaryDataResponse.json();
        const summary = JSON.parse(summaryData.text_value || '{}');
        
        setAnalysisResults(prev => ({ ...prev, summary }));
        markStepCompleted('summary');

        // Step 7: Individual Ticket Analysis
        updateLoadingState('ticketAnalysis', true);
        const ticketPayload = {
          created_object_names: ['ticket_analysis'],
          prompt_string: `Combine all analysis for individual ticket display: {support_tickets}, {sentiment_analysis}, {escalation_risk}, {category_analysis}
          
          For each ticket, provide:
          - All original ticket data
          - Sentiment score and emotion
          - Risk level and factors
          - Category validation
          - Recommended actions
          - Priority color coding (red=critical/high, yellow=medium, green=low)
          
          Return as JSON array suitable for table display with color coding indicators.`,
          inputs: [
            { input_object_name: 'support_tickets', mode: 'combine_events' },
            { input_object_name: 'sentiment_analysis', mode: 'combine_events' },
            { input_object_name: 'escalation_risk', mode: 'combine_events' },
            { input_object_name: 'category_analysis', mode: 'combine_events' }
          ]
        };

        const ticketResponse = await fetch(`${API_BASE}/apply_prompt`, {
          method: 'POST',
          headers: API_HEADERS,
          body: JSON.stringify(ticketPayload)
        });
        const ticketResult = await ticketResponse.json();
        logApiCall('/apply_prompt', 'POST', ticketPayload, ticketResult);

        // Get ticket data immediately
        const ticketsDataResponse = await fetch(`${API_BASE}/return_data/ticket_analysis`, { headers: API_HEADERS });
        const ticketsData = await ticketsDataResponse.json();
        const tickets = JSON.parse(ticketsData.text_value || '[]');
        
        setAnalysisResults(prev => ({ ...prev, tickets }));
        setRawApiData({ summary, tickets, templates });
        markStepCompleted('ticketAnalysis');
      };

      reader.readAsText(csvFile);
    } catch (err) {
      setError('Analysis failed: ' + err.message);
      logApiCall('ERROR', 'N/A', null, { error: err.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const deleteApiObjects = async () => {
    const objectsToDelete = [
      'support_tickets',
      'sentiment_analysis',
      'category_analysis',
      'escalation_risk',
      'response_templates',
      'executive_summary',
      'ticket_analysis'
    ];

    for (const objectName of objectsToDelete) {
      try {
        const response = await fetch(`${API_BASE}/objects/${objectName}`, {
          method: 'DELETE',
          headers: API_HEADERS
        });
        const result = await response.json();
        logApiCall(`/objects/${objectName}`, 'DELETE', null, result);
      } catch (err) {
        logApiCall(`/objects/${objectName}`, 'DELETE', null, { error: err.message });
      }
    }
  };

  const downloadCSV = () => {
    if (!analysisResults?.tickets || analysisResults.tickets.length === 0) return;

    const headers = ['Ticket ID', 'Customer', 'Subject', 'Priority', 'Sentiment', 'Risk Level', 'Category', 'Status'];
    const csvContent = [
      headers.join(','),
      ...analysisResults.tickets.map(ticket => [
        ticket.ticket_id,
        ticket.customer_name,
        `"${ticket.subject}"`,
        ticket.priority,
        ticket.sentiment,
        ticket.risk_level,
        ticket.category,
        ticket.status
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'support_analysis_results.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getPriorityColor = (priority, riskLevel) => {
    if (riskLevel === 'CRITICAL' || priority === 'Critical') return 'text-danger fw-bold';
    if (riskLevel === 'HIGH' || priority === 'High') return 'text-danger';
    if (riskLevel === 'MEDIUM' || priority === 'Medium') return 'text-warning';
    return 'text-success';
  };

  const resetAnalysis = () => {
    setCurrentStep(1);
    setCsvFile(null);
    setAnalysisResults({ summary: {}, tickets: [], templates: [] });
    setError(null);
    setApiLogs([]);
    setRawApiData(null);
    setLoadingStates({
      ingestion: false,
      sentiment: false,
      categorization: false,
      escalation: false,
      templates: false,
      summary: false,
      ticketAnalysis: false
    });
    setCompletedSteps({
      ingestion: false,
      sentiment: false,
      categorization: false,
      escalation: false,
      templates: false,
      summary: false,
      ticketAnalysis: false
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Loading skeleton component
  const LoadingSkeleton = ({ width = "100%", height = "20px", className = "" }) => (
    <div 
      className={`bg-gray-200 dark:bg-gray-700 animate-pulse rounded ${className}`}
      style={{ width, height }}
    />
  );

  // Progress indicator component
  const ProgressIndicator = ({ step, isLoading, isCompleted, title }) => (
    <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold ${
        isCompleted ? 'bg-green-500 text-white' :
        isLoading ? 'bg-blue-500 text-white' :
        'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
      }`}>
        {isCompleted ? '✓' : isLoading ? '⟳' : step}
      </div>
      <span className={`text-sm font-medium ${
        isCompleted ? 'text-green-700 dark:text-green-300' :
        isLoading ? 'text-blue-700 dark:text-blue-300' :
        'text-gray-600 dark:text-gray-400'
      }`}>
        {title}
      </span>
      {isLoading && (
        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      )}
    </div>
  );

  // Simple chart component for visual data representation
  const SimpleBarChart = ({ data, title, color = '#3b82f6', isLoading = false }) => {
    if (isLoading || !data || data.length === 0) {
      return (
        <div className="chart-container">
          <h4 className="text-lg font-semibold mb-3">{title}</h4>
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center">
                <LoadingSkeleton width="80px" height="20px" className="mr-3" />
                <LoadingSkeleton width="200px" height="24px" />
              </div>
            ))}
          </div>
        </div>
      );
    }
    
    const maxValue = Math.max(...data.map(d => d.value));
    
    return (
      <div className="chart-container">
        <h4 className="text-lg font-semibold mb-3">{title}</h4>
        <div className="space-y-2">
          {data.map((item, index) => (
            <div key={index} className="flex items-center">
              <div className="w-24 text-sm font-medium text-right mr-3">{item.label}</div>
              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 relative">
                <div
                  className="h-6 rounded-full flex items-center justify-end pr-2 text-white text-sm font-medium transition-all duration-500"
                  style={{
                    width: `${(item.value / maxValue) * 100}%`,
                    backgroundColor: color,
                    minWidth: '30px'
                  }}
                >
                  {item.value}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Donut chart component for sentiment distribution
  const DonutChart = ({ data, title, isLoading = false }) => {
    if (isLoading || !data || data.length === 0) {
      return (
        <div className="chart-container">
          <h4 className="text-lg font-semibold mb-3">{title}</h4>
          <div className="flex items-center justify-center">
            <LoadingSkeleton width="128px" height="128px" className="rounded-full mr-6" />
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center">
                  <LoadingSkeleton width="16px" height="16px" className="rounded mr-2" />
                  <LoadingSkeleton width="100px" height="16px" />
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
    
    const total = data.reduce((sum, item) => sum + item.value, 0);
    const colors = ['#10b981', '#f59e0b', '#ef4444', '#dc2626'];
    
    return (
      <div className="chart-container">
        <h4 className="text-lg font-semibold mb-3">{title}</h4>
        <div className="flex items-center justify-center">
          <div className="relative w-32 h-32">
            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
              {data.map((item, index) => {
                const percentage = (item.value / total) * 100;
                const strokeDasharray = `${percentage} ${100 - percentage}`;
                const strokeDashoffset = data.slice(0, index).reduce((sum, prev) => sum + (prev.value / total) * 100, 0);
                
                return (
                  <circle
                    key={index}
                    cx="50"
                    cy="50"
                    r="15.915"
                    fill="transparent"
                    stroke={colors[index]}
                    strokeWidth="8"
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={-strokeDashoffset}
                    className="transition-all duration-500"
                  />
                );
              })}
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-2xl font-bold">{total}</span>
            </div>
          </div>
          <div className="ml-6 space-y-2">
            {data.map((item, index) => (
              <div key={index} className="flex items-center">
                <div
                  className="w-4 h-4 rounded mr-2"
                  style={{ backgroundColor: colors[index] }}
                ></div>
                <span className="text-sm">{item.label}: {item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`min-h-screen ${darkMode ? 'dark bg-gray-900 text-white' : 'bg-gray-50'}`}>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-primary-600 dark:text-primary-400">
              Customer Support Intelligence Report
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Comprehensive analysis and insights for support operations
            </p>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="px-4 py-2 rounded-2xl bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? '☀️' : '🌙'}
            </button>
            {currentStep === 3 && (
              <>
                <button
                  onClick={() => setShowRawData(!showRawData)}
                  className="px-4 py-2 bg-green-500 text-white rounded-2xl hover:bg-green-600 transition-colors"
                >
                  {showRawData ? 'Hide' : 'Show'} Raw Data
                </button>
                <button
                  onClick={deleteApiObjects}
                  className="px-4 py-2 bg-red-500 text-white rounded-2xl hover:bg-red-600 transition-colors"
                >
                  Delete API Objects
                </button>
              </>
            )}
          </div>
        </div>

        {/* Step 1: File Upload */}
        {currentStep === 1 && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
              <h2 className="text-2xl font-semibold mb-6 text-center">Upload Support Tickets CSV</h2>
              
              <div
                className="border-2 border-dashed border-primary-300 dark:border-primary-600 rounded-2xl p-12 text-center hover:border-primary-500 transition-colors cursor-pointer"
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <div className="text-6xl mb-4">📊</div>
                <h3 className="text-xl font-medium mb-2">Drag and drop your CSV file here</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">or click to browse files</p>
                <button className="px-6 py-3 bg-primary-500 text-white rounded-2xl hover:bg-primary-600 transition-colors">
                  Choose File
                </button>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                aria-label="Upload CSV file"
              />

              {error && (
                <div className="mt-4 p-4 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-2xl">
                  {error}
                </div>
              )}

              <div className="mt-6 text-sm text-gray-600 dark:text-gray-400">
                <p className="font-medium mb-2">Expected CSV columns:</p>
                <p>ticket_id, customer_name, customer_email, subject, description, priority, category, status, created_date, assigned_agent, customer_tier, resolution_time_hours, satisfaction_score</p>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Processing */}
        {currentStep === 2 && (
          <div className="max-w-2xl mx-auto">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
              <h2 className="text-2xl font-semibold mb-6">Ready to Analyze</h2>
              
              <div className="mb-6">
                <div className="text-4xl mb-4">📋</div>
                <p className="text-lg mb-2">File: <strong>{csvFile?.name}</strong></p>
                <p className="text-gray-600 dark:text-gray-400">Size: {(csvFile?.size / 1024).toFixed(1)} KB</p>
              </div>

              {!isProcessing ? (
                <div className="space-y-4">
                  <button
                    onClick={processAnalysis}
                    className="px-8 py-4 bg-green-500 text-white rounded-2xl hover:bg-green-600 transition-colors text-lg font-medium"
                  >
                    Start Analysis
                  </button>
                  <div>
                    <button
                      onClick={resetAnalysis}
                      className="px-6 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
                    >
                      Choose Different File
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="spinner mx-auto mb-4"></div>
                  <p className="text-lg font-medium mb-2">Analyzing Support Data...</p>
                  <p className="text-gray-600 dark:text-gray-400">This may take a few moments</p>
                  <button
                    onClick={() => setIsProcessing(false)}
                    className="mt-4 px-4 py-2 text-red-600 hover:text-red-800 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3: Progressive Loading Dashboard */}
        {currentStep === 3 && (
          <div className="space-y-8">
            {/* Progress Indicator */}
            {isProcessing && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Analysis Progress</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <ProgressIndicator 
                    step="1" 
                    isLoading={loadingStates.ingestion} 
                    isCompleted={completedSteps.ingestion} 
                    title="Data Ingestion" 
                  />
                  <ProgressIndicator 
                    step="2" 
                    isLoading={loadingStates.sentiment} 
                    isCompleted={completedSteps.sentiment} 
                    title="Sentiment Analysis" 
                  />
                  <ProgressIndicator 
                    step="3" 
                    isLoading={loadingStates.categorization} 
                    isCompleted={completedSteps.categorization} 
                    title="Categorization" 
                  />
                  <ProgressIndicator 
                    step="4" 
                    isLoading={loadingStates.escalation} 
                    isCompleted={completedSteps.escalation} 
                    title="Risk Assessment" 
                  />
                  <ProgressIndicator 
                    step="5" 
                    isLoading={loadingStates.templates} 
                    isCompleted={completedSteps.templates} 
                    title="Response Templates" 
                  />
                  <ProgressIndicator 
                    step="6" 
                    isLoading={loadingStates.summary} 
                    isCompleted={completedSteps.summary} 
                    title="Executive Summary" 
                  />
                  <ProgressIndicator 
                    step="7" 
                    isLoading={loadingStates.ticketAnalysis} 
                    isCompleted={completedSteps.ticketAnalysis} 
                    title="Ticket Analysis" 
                  />
                </div>
              </div>
            )}

            {/* Report Header */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 border-l-4 border-primary-500">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    Customer Support Intelligence Report
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400">
                    Generated on {new Date().toLocaleDateString()} • Analysis of {analysisResults.tickets?.length || '...'} support tickets
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={resetAnalysis}
                    className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                  >
                    New Analysis
                  </button>
                  <button
                    onClick={downloadCSV}
                    disabled={!analysisResults.tickets || analysisResults.tickets.length === 0}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Export CSV
                  </button>
                </div>
              </div>
            </div>

            {/* Executive Summary Section */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                  <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">1</span>
                  Executive Summary
                  {loadingStates.summary && <div className="ml-3 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
                </h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-600 dark:text-blue-400 text-sm font-medium">Total Tickets</p>
                      <p className="text-3xl font-bold text-blue-800 dark:text-blue-200">
                        {completedSteps.summary ? 
                          (analysisResults.summary.total_tickets || analysisResults.tickets?.length || '0') :
                          <LoadingSkeleton width="60px" height="36px" />
                        }
                      </p>
                    </div>
                    <div className="text-blue-500 text-2xl">📊</div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 p-6 rounded-xl border border-green-200 dark:border-green-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-green-600 dark:text-green-400 text-sm font-medium">Avg Resolution</p>
                      <p className="text-3xl font-bold text-green-800 dark:text-green-200">
                        {completedSteps.summary ? 
                          `${analysisResults.summary.avg_resolution_time || '...'}h` :
                          <LoadingSkeleton width="60px" height="36px" />
                        }
                      </p>
                    </div>
                    <div className="text-green-500 text-2xl">⏱️</div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 p-6 rounded-xl border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-yellow-600 dark:text-yellow-400 text-sm font-medium">Satisfaction</p>
                      <p className="text-3xl font-bold text-yellow-800 dark:text-yellow-200">
                        {completedSteps.summary ? 
                          `${analysisResults.summary.avg_satisfaction || '...'}/5` :
                          <LoadingSkeleton width="60px" height="36px" />
                        }
                      </p>
                    </div>
                    <div className="text-yellow-500 text-2xl">⭐</div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 p-6 rounded-xl border border-red-200 dark:border-red-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-red-600 dark:text-red-400 text-sm font-medium">High Risk</p>
                      <p className="text-3xl font-bold text-red-800 dark:text-red-200">
                        {completedSteps.escalation ? 
                          (analysisResults.summary.high_risk_count || 
                           analysisResults.tickets?.filter(t => t.risk_level === 'HIGH' || t.risk_level === 'CRITICAL').length || '0') :
                          <LoadingSkeleton width="60px" height="36px" />
                        }
                      </p>
                    </div>
                    <div className="text-red-500 text-2xl">🚨</div>
                  </div>
                </div>
              </div>

              {/* Visual Charts Section */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Sentiment Distribution Chart */}
                <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl">
                  <DonutChart
                    title="Sentiment Distribution"
                    isLoading={!completedSteps.sentiment}
                    data={completedSteps.sentiment ? [
                      { label: 'Positive', value: analysisResults.tickets?.filter(t => t.sentiment === 'Positive').length || 0 },
                      { label: 'Neutral', value: analysisResults.tickets?.filter(t => t.sentiment === 'Neutral').length || 0 },
                      { label: 'Negative', value: analysisResults.tickets?.filter(t => t.sentiment === 'Negative').length || 0 },
                      { label: 'Very Negative', value: analysisResults.tickets?.filter(t => t.sentiment === 'Very Negative').length || 0 }
                    ] : []}
                  />
                </div>

                {/* Priority Distribution Chart */}
                <div className="bg-gray-50 dark:bg-gray-700/50 p-6 rounded-xl">
                  <SimpleBarChart
                    title="Tickets by Priority"
                    color="#ef4444"
                    isLoading={!completedSteps.ticketAnalysis}
                    data={completedSteps.ticketAnalysis ? [
                      { label: 'Critical', value: analysisResults.tickets?.filter(t => t.priority === 'Critical').length || 0 },
                      { label: 'High', value: analysisResults.tickets?.filter(t => t.priority === 'High').length || 0 },
                      { label: 'Medium', value: analysisResults.tickets?.filter(t => t.priority === 'Medium').length || 0 },
                      { label: 'Low', value: analysisResults.tickets?.filter(t => t.priority === 'Low').length || 0 }
                    ] : []}
                  />
                </div>
              </div>
            </div>

            {/* Critical Alerts Section */}
            {(completedSteps.escalation && analysisResults.tickets?.filter(t => t.risk_level === 'CRITICAL' || t.risk_level === 'HIGH').length > 0) && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6">
                <div className="border-b border-red-200 dark:border-red-700 pb-4 mb-6">
                  <h2 className="text-xl font-bold text-red-800 dark:text-red-200 flex items-center">
                    <span className="bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">🚨</span>
                    Critical Alerts - Immediate Action Required
                  </h2>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-red-200 dark:border-red-700">
                        <th className="text-left py-3 px-4 font-semibold text-red-800 dark:text-red-200">Ticket ID</th>
                        <th className="text-left py-3 px-4 font-semibold text-red-800 dark:text-red-200">Customer</th>
                        <th className="text-left py-3 px-4 font-semibold text-red-800 dark:text-red-200">Issue</th>
                        <th className="text-left py-3 px-4 font-semibold text-red-800 dark:text-red-200">Risk Level</th>
                        <th className="text-left py-3 px-4 font-semibold text-red-800 dark:text-red-200">Action Required</th>
                      </tr>
                    </thead>
                    <tbody>
                      {analysisResults.tickets
                        ?.filter(t => t.risk_level === 'CRITICAL' || t.risk_level === 'HIGH')
                        .map((ticket, index) => (
                        <tr key={index} className="border-b border-red-100 dark:border-red-800/50">
                          <td className="py-3 px-4 font-mono text-sm">{ticket.ticket_id}</td>
                          <td className="py-3 px-4">
                            <div className="font-medium">{ticket.customer_name}</div>
                            <div className="text-sm text-red-600 dark:text-red-400">{ticket.customer_tier}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium">{ticket.subject}</div>
                            <div className="text-sm text-red-600 dark:text-red-400">{ticket.sentiment}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              ticket.risk_level === 'CRITICAL' 
                                ? 'bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200' 
                                : 'bg-orange-200 text-orange-800 dark:bg-orange-800 dark:text-orange-200'
                            }`}>
                              {ticket.risk_level}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-sm">
                            {ticket.recommended_actions?.slice(0, 2).join(', ') || 'Escalate immediately'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Detailed Ticket Analysis Section */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                  <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">2</span>
                  Detailed Ticket Analysis
                  {loadingStates.ticketAnalysis && <div className="ml-3 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
                </h2>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700">
                      <th className="text-left py-4 px-4 font-semibold border-b border-gray-200 dark:border-gray-600">Ticket</th>
                      <th className="text-left py-4 px-4 font-semibold border-b border-gray-200 dark:border-gray-600">Customer</th>
                      <th className="text-left py-4 px-4 font-semibold border-b border-gray-200 dark:border-gray-600">Issue Details</th>
                      <th className="text-left py-4 px-4 font-semibold border-b border-gray-200 dark:border-gray-600">Analysis</th>
                      <th className="text-left py-4 px-4 font-semibold border-b border-gray-200 dark:border-gray-600">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedSteps.ticketAnalysis ? (
                      analysisResults.tickets?.map((ticket, index) => (
                        <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                          <td className="py-4 px-4">
                            <div className="font-mono text-sm font-medium">{ticket.ticket_id}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">{ticket.created_date}</div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="font-medium">{ticket.customer_name}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400">{ticket.customer_email}</div>
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium mt-1 ${
                              ticket.customer_tier === 'VIP' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                              ticket.customer_tier === 'Premium' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                              'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                            }`}>
                              {ticket.customer_tier}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="font-medium mb-1">{ticket.subject}</div>
                            <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">{ticket.category}</div>
                            <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                              ticket.priority === 'Critical' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                              ticket.priority === 'High' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200' :
                              ticket.priority === 'Medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                              'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                            }`}>
                              {ticket.priority}
                            </span>
                          </td>
                          <td className="py-4 px-4">
                            <div className="space-y-1">
                              <div className="flex items-center">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-16">Sentiment:</span>
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  ticket.sentiment === 'Positive' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                  ticket.sentiment === 'Neutral' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' :
                                  ticket.sentiment === 'Negative' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                  'bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-100'
                                }`}>
                                  {ticket.sentiment}
                                </span>
                              </div>
                              <div className="flex items-center">
                                <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-16">Risk:</span>
                                <span className={`text-xs px-2 py-1 rounded-full ${
                                  ticket.risk_level === 'CRITICAL' ? 'bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-100' :
                                  ticket.risk_level === 'HIGH' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                  ticket.risk_level === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                  'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                }`}>
                                  {ticket.risk_level}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="py-4 px-4">
                            <div className="space-y-1">
                              <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                                ticket.status === 'Resolved' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                ticket.status === 'In Progress' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                              }`}>
                                {ticket.status}
                              </span>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                Agent: {ticket.assigned_agent}
                              </div>
                              {ticket.resolution_time_hours && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {ticket.resolution_time_hours}h resolution
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      // Loading skeleton rows
                      Array.from({ length: 5 }).map((_, index) => (
                        <tr key={index} className="border-b border-gray-100 dark:border-gray-700">
                          <td className="py-4 px-4">
                            <LoadingSkeleton width="80px" height="16px" className="mb-2" />
                            <LoadingSkeleton width="60px" height="12px" />
                          </td>
                          <td className="py-4 px-4">
                            <LoadingSkeleton width="120px" height="16px" className="mb-2" />
                            <LoadingSkeleton width="150px" height="12px" className="mb-2" />
                            <LoadingSkeleton width="60px" height="20px" />
                          </td>
                          <td className="py-4 px-4">
                            <LoadingSkeleton width="200px" height="16px" className="mb-2" />
                            <LoadingSkeleton width="80px" height="12px" className="mb-2" />
                            <LoadingSkeleton width="60px" height="20px" />
                          </td>
                          <td className="py-4 px-4">
                            <LoadingSkeleton width="100px" height="16px" className="mb-2" />
                            <LoadingSkeleton width="80px" height="16px" />
                          </td>
                          <td className="py-4 px-4">
                            <LoadingSkeleton width="80px" height="20px" className="mb-2" />
                            <LoadingSkeleton width="100px" height="12px" />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Trend Analysis Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                    <span className="text-blue-500 mr-2">📈</span>
                    Daily Patterns
                    {loadingStates.summary && <div className="ml-2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
                  </h3>
                </div>
                <div className="space-y-3">
                  {completedSteps.summary ? (
                    analysisResults.summary.daily_trends?.map((trend, i) => (
                      <div key={i} className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-sm text-blue-800 dark:text-blue-200">{trend}</p>
                      </div>
                    )) || (
                      <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-400">No daily trends available</p>
                      </div>
                    )
                  ) : (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <LoadingSkeleton width="100%" height="16px" />
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                    <span className="text-green-500 mr-2">📊</span>
                    Category Trends
                    {loadingStates.summary && <div className="ml-2 w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />}
                  </h3>
                </div>
                <div className="space-y-3">
                  {completedSteps.summary ? (
                    analysisResults.summary.category_trends?.map((trend, i) => (
                      <div key={i} className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="text-sm text-green-800 dark:text-green-200">{trend}</p>
                      </div>
                    )) || (
                      <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-400">No category trends available</p>
                      </div>
                    )
                  ) : (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <LoadingSkeleton width="100%" height="16px" />
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center">
                    <span className="text-orange-500 mr-2">🔍</span>
                    Emerging Issues
                    {loadingStates.summary && <div className="ml-2 w-4 h-4 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />}
                  </h3>
                </div>
                <div className="space-y-3">
                  {completedSteps.summary ? (
                    analysisResults.summary.emerging_issues?.map((issue, i) => (
                      <div key={i} className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                        <p className="text-sm text-orange-800 dark:text-orange-200">{issue}</p>
                      </div>
                    )) || (
                      <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <p className="text-sm text-gray-600 dark:text-gray-400">No emerging issues detected</p>
                      </div>
                    )
                  ) : (
                    Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <LoadingSkeleton width="100%" height="16px" />
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Response Templates Section */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
              <div className="border-b border-gray-200 dark:border-gray-700 pb-4 mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center">
                  <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full w-8 h-8 flex items-center justify-center text-sm font-bold mr-3">3</span>
                  Response Templates
                  {loadingStates.templates && <div className="ml-3 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />}
                </h2>
                <p className="text-gray-600 dark:text-gray-400 mt-2">
                  Personalized response templates based on category, sentiment, and customer tier
                </p>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {completedSteps.templates ? (
                  analysisResults.templates?.length > 0 ? (
                    analysisResults.templates.map((template, index) => (
                      <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-xl p-6 hover:shadow-md transition-shadow">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-bold text-lg text-gray-900 dark:text-white">
                              {template.category} Support
                            </h3>
                            <div className="flex gap-2 mt-2">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                template.sentiment === 'Positive' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                template.sentiment === 'Neutral' ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200' :
                                template.sentiment === 'Negative' ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' :
                                'bg-red-200 text-red-900 dark:bg-red-800 dark:text-red-100'
                              }`}>
                                {template.sentiment} Sentiment
                              </span>
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                template.tier === 'VIP' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' :
                                template.tier === 'Premium' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' :
                                'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
                              }`}>
                                {template.tier} Customer
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4">
                          <h4 className="font-medium text-gray-900 dark:text-white mb-2">Template:</h4>
                          <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap font-mono">
                            {template.template_text}
                          </div>
                        </div>
                        
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                          <h4 className="font-medium text-blue-800 dark:text-blue-200 text-sm mb-1">Tone Guidelines:</h4>
                          <p className="text-sm text-blue-700 dark:text-blue-300">{template.tone_notes}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="col-span-2 text-center py-8">
                      <p className="text-gray-500 dark:text-gray-400">No response templates generated</p>
                    </div>
                  )
                ) : (
                  // Loading skeleton for templates
                  Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="border border-gray-200 dark:border-gray-600 rounded-xl p-6">
                      <div className="mb-4">
                        <LoadingSkeleton width="150px" height="24px" className="mb-2" />
                        <div className="flex gap-2">
                          <LoadingSkeleton width="100px" height="24px" />
                          <LoadingSkeleton width="120px" height="24px" />
                        </div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4">
                        <LoadingSkeleton width="80px" height="16px" className="mb-2" />
                        <LoadingSkeleton width="100%" height="60px" />
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                        <LoadingSkeleton width="100px" height="16px" className="mb-1" />
                        <LoadingSkeleton width="100%" height="32px" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Report Footer */}
            <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl p-6 text-center">
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Report generated by Customer Support Intelligence Analyzer • 
                For questions or support, contact your system administrator
              </p>
              <div className="mt-4 flex justify-center gap-4">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Print Report
                </button>
                <button
                  onClick={downloadCSV}
                  disabled={!analysisResults.tickets || analysisResults.tickets.length === 0}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Export Data
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Raw Data Display */}
        {showRawData && rawApiData && (
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">Raw API Data</h2>
            <pre className="bg-gray-100 dark:bg-gray-700 p-4 rounded-xl overflow-auto text-sm">
              {JSON.stringify(rawApiData, null, 2)}
            </pre>
          </div>
        )}

        {/* API Logs */}
        {apiLogs.length > 0 && (
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
            <h2 className="text-2xl font-semibold mb-4">API Call Logs</h2>
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {apiLogs.map((log) => (
                <div key={log.id} className="border dark:border-gray-600 rounded-xl p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-mono text-sm bg-blue-100 dark:bg-blue-900 px-2 py-1 rounded">
                      {log.method} {log.endpoint}
                    </span>
                    <span className="text-xs text-gray-500">{log.timestamp}</span>
                  </div>
                  {log.payload && (
                    <details className="mb-2">
                      <summary className="cursor-pointer text-sm font-medium">Request Payload</summary>
                      <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded mt-1 overflow-auto">
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </details>
                  )}
                  <details>
                    <summary className="cursor-pointer text-sm font-medium">Response</summary>
                    <pre className="text-xs bg-gray-100 dark:bg-gray-700 p-2 rounded mt-1 overflow-auto">
                      {JSON.stringify(log.response, null, 2)}
                    </pre>
                  </details>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerSupportAnalyzer;
