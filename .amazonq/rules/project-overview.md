# AI Diagnostic Assistant for Streaming Platform

## Project Purpose

This is an AI-powered diagnostic assistant designed to help streaming platform employees troubleshoot issues with entities such as offers, campaigns, products, and packages. The system specializes in identifying problems stemming from configuration, publishing, or operational factors within internal entity creation tools.

## Core Functionality

The assistant follows a structured diagnostic workflow:

1. **Problem Categorization** - Classifies user queries into specific categories (ENTITY_STATUS, UI_ISSUE, DATA_INCONSISTENCY, DATA_MAPPING, ENTITY_CONFIGURATION, OFFER_PRICE, SYSTEM_BEHAVIOR, GENERAL_QUESTION, UNKNOWN_CATEGORY)

2. **Information Extraction** - Identifies entity IDs, types, environments, and timeframes from user queries

3. **Environment Validation** - Ensures proper environment specification (production, staging, development) before investigation

4. **Parallel Data Collection** - Fetches data from multiple sources:
   - Datadog logs for error analysis
   - Genie GraphQL API for offer management data
   - Entity history for configuration changes
   - UPS (Unified Pricing Service) for pricing data

5. **Analysis & Diagnosis** - Synthesizes collected data to identify root causes and provide actionable insights

6. **Learning System** - Stores diagnostic cases in MongoDB for continuous improvement and pattern recognition

## Key Technologies

- **Node.js/TypeScript** - Core application framework
- **LangGraph** - Workflow orchestration and state management
- **MongoDB** - Long-term memory storage for cases and patterns
- **External APIs**: Datadog, Genie GraphQL, Offer Service, UPS
- **AI Models**: Anthropic Claude, OpenAI GPT for natural language processing

## Special Handling

- **Offer Pricing Issues** - Prioritizes pricing-specific tools and recognizes 3PP/IAP offers as externally managed
- **Environment Validation** - Mandatory environment specification before tool execution
- **Memory-Enhanced Diagnostics** - Leverages historical cases for improved accuracy
- **Structured Response Format** - Uses Markdown formatting with clear headings and full entity IDs

## Architecture

The system uses a node-based workflow architecture where each diagnostic step is a separate node that can be executed in parallel or sequence based on the problem category and available data.