# PDF Extraction via MCP

PDF extraction for the Salvage Union Workshop Manual is now handled via the MCP (Model Context Protocol) PDF extraction tool.

## Using MCP PDF Extraction

The MCP PDF extraction tool (`mcp_pdf-extraction_extract-pdf-contents`) provides access to PDF content without requiring local dependencies.

### Features

- Extract text from specific pages or page ranges
- Access PDF content programmatically through MCP
- No local PDF parsing libraries required

### PDF Location

The PDF file must be located at `.rules/Salvage Union Core Book Digital Edition 2.0a.pdf`

## Migration Notes

Local PDF parsing tools (`pdfReader.ts`, `findPageNumber.ts`, `updatePageNumbers.ts`, `pdfSearch.ts`) have been removed in favor of MCP-based extraction. All PDF operations should now use the MCP PDF extraction tool.
