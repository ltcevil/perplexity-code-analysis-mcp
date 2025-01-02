# Perplexity MCP Server

A Model Context Protocol (MCP) server that provides intelligent code analysis and debugging capabilities using Perplexity AI's API. Works seamlessly with the Claude desktop client.

<a href="https://glama.ai/mcp/servers/oxchzx8c75"><img width="380" height="200" src="https://glama.ai/mcp/servers/oxchzx8c75/badge" alt="Perplexity Server MCP server" /></a>

## Features

- **Intelligent Error Analysis**: Detailed breakdown of coding errors with root cause analysis
- **Pattern Detection**: Automatically recognizes common error patterns and provides targeted solutions
- **Comprehensive Solutions**: Step-by-step fixes with multiple implementation alternatives
- **Best Practices**: Includes coding standards and error prevention tips
- **Python Support**: Specialized handling of Python type errors and common coding issues

## Example Usage

Ask questions like:
- "Fix this TypeError in my Python code"
- "What's causing this error message?"
- "How do I fix this code?"

Include your code snippet for targeted analysis:

```python
def calculate_total(items):
    total = 0
    for item in items:
        total = total + item['price']  # TypeError: string + int

data = [
    {'name': 'Book', 'price': '10'},
    {'name': 'Pen', 'price': '2'}
]

result = calculate_total(data)
```

The server will provide:
1. Root cause analysis of the error
2. Step-by-step solution with code examples
3. Best practices to prevent similar issues
4. Alternative implementation approaches

## Installation

### Prerequisites
- Node.js 18 or higher
- A Perplexity AI API key

### Option 1: Install from npm (Recommended)

```bash
# Using npm
npm install -g perplexity-mcp

# Or using the repository directly
npm install -g git+https://github.com/yourusername/perplexity-mcp.git
```

### Option 2: Install from Source

1. Clone the repository:
```bash
git clone https://github.com/yourusername/perplexity-server.git
cd perplexity-server
```

2. Install dependencies:
```bash
npm install
```

3. Build and install globally:
```bash
npm run build
npm install -g .
```

### Configure Claude Desktop


Add to your Claude desktop configuration file:

**MacOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows**: `%APPDATA%/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "perplexity": {
      "command": "perplexity-mcp",
      "args": [],
      "env": {
        "PERPLEXITY_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Or if installed from source:

```json
{
  "mcpServers": {
    "perplexity": {
      "command": "node",
      "args": ["/absolute/path/to/perplexity-server/build/index.js"],
      "env": {
        "PERPLEXITY_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Security

- The API key is stored securely in Claude's desktop configuration file
- The key is passed to the server as an environment variable
- No sensitive data is stored in the repository
- The server expects the API key to be provided by Claude's environment

## Development

### Project Structure

```
perplexity-server/
├── src/
│   └── index.ts      # Main server implementation
├── package.json      # Project configuration
└── tsconfig.json    # TypeScript configuration
```

### Available Scripts

- `npm run build`: Build the project
- `npm run watch`: Watch for changes and rebuild automatically
- `npm run prepare`: Prepare the package for publishing
- `npm run inspector`: Run the MCP inspector for debugging

### Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Thanks to [Perplexity AI](https://www.perplexity.ai/) for their powerful API
- Built with [Model Context Protocol](https://github.com/anthropics/model-context-protocol)
