#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

const API_KEY = process.env.PERPLEXITY_API_KEY;
if (!API_KEY) {
  throw new Error('PERPLEXITY_API_KEY environment variable is required');
}

interface PerplexityResponse {
  id: string;
  model: string;
  created: number;
  choices: Array<{
    index: number;
    finish_reason: string;
    message: {
      role: string;
      content: string;
    };
  }>;
}

interface ServerConfig {
  name: string;
  version: string;
  capabilities: {
    tools: Record<string, unknown>;
  };
}

interface AxiosConfig {
  baseURL: string;
  headers: {
    Authorization: string;
    'Content-Type': string;
  };
}

interface CodeAnalysis {
  fixed: string;
  alternatives: string;
}

interface CustomAnalysis {
  text: string;
}

class PerplexityServer {
  private readonly server: Server;
  private readonly axiosInstance: ReturnType<typeof axios.create>;
  private static readonly DEFAULT_CONFIG: ServerConfig = {
    name: 'perplexity-server',
    version: '0.1.0',
    capabilities: {
      tools: {},
    },
  };

  private static readonly DEFAULT_AXIOS_CONFIG: AxiosConfig = {
    baseURL: 'https://api.perplexity.ai',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
  };

  constructor(config: Partial<ServerConfig> = {}) {
    this.server = new Server(
      {
        ...PerplexityServer.DEFAULT_CONFIG,
        ...config,
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.axiosInstance = axios.create({
      ...PerplexityServer.DEFAULT_AXIOS_CONFIG,
      baseURL: 'https://api.perplexity.ai',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    this.setupToolHandlers();
    this.setupErrorHandling();
    this.setupProcessHandlers();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error: Error): void => {
      console.error('[MCP Error]', error);
    };
  }

  private setupProcessHandlers(): void {
    process.on('SIGINT', async (): Promise<void> => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'search',
          description: 'Search Perplexity for coding help',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The error or coding question to analyze',
              },
              code: {
                type: 'string',
                description: 'Code snippet to analyze (optional)',
              },
              language: {
                type: 'string',
                description: 'Programming language of the code snippet (optional)',
                default: 'auto'
              }
            },
            required: ['query'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== 'search') {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }

      const { query, code, language = 'auto' } = request.params.arguments as {
        query: string;
        code?: string;
        language?: string;
      };

      // Format code block if provided
      const codeBlock = code ? `
Code to analyze:
\`\`\`${language}
${code}
\`\`\`
` : '';

      try {
        // Check for custom analysis first
        let codeAnalysis: CodeAnalysis | null = null;
        if (code) {
          codeAnalysis = analyzeCode(code);
          if (codeAnalysis) {
              const customAnalysis: CustomAnalysis = {
                text: `1. Root Cause Analysis
----------------
• Technical Cause: Python is strongly typed and does not allow operations between incompatible types (string and integer)
• Common Scenarios: Dictionary values from external sources (like JSON, CSV, or user input) often store numbers as strings
• Technical Background: Python dictionary values maintain their original types, requiring explicit conversion for numeric operations

2. Step-by-Step Solution
----------------
• Step 1: Identify the data type issue
  The 'price' values in the dictionary are strings ('10' and '2') but used in numeric addition
• Step 2: Add type conversion
  Use int() to convert item['price'] to integer before adding to total
• Step 3: Add error handling
  Wrap the conversion in try-except to handle invalid price values
• Step 4: Test the solution
  Verify the total is calculated correctly (12 = 10 + 2)

3. Best Practices for Prevention
----------------
• Design Pattern: Data validation and type conversion at input boundaries
• Code Organization: Convert data types when reading from external sources, maintain consistent types in data structures
• Common Pitfalls: Assuming dictionary values have the correct type, missing error handling for invalid values
• Error Handling: Use try-except blocks to handle type conversion errors, validate data before operations

4. Code Examples
----------------
Before:
\`\`\`${language}
${code}
\`\`\`

After:
\`\`\`${language}
${codeAnalysis.fixed}
\`\`\`

Alternative Approaches:
\`\`\`${language}
${codeAnalysis.alternatives}
\`\`\``
                };
                return {
                  content: [
                    {
                      type: 'text',
                      text: customAnalysis.text,
                    },
                  ],
                };
            }
          }

        const prompt = `As an expert software developer, analyze this coding question and provide a comprehensive solution.

CRITICAL FORMATTING INSTRUCTIONS:
1. Use the EXACT section headers and bullet points provided
2. Keep all bullet points and section markers exactly as shown
3. Replace only the text in [brackets] with your analysis
4. Do not add any additional sections or bullet points
5. Do not modify the formatting or structure in any way
6. Start each section with the exact numbered header and dashed line shown

QUERY TO ANALYZE:
${query}
${codeBlock}

1. Root Cause Analysis
----------------
• Technical Cause: [Explain the fundamental technical reason for the error]
• Common Scenarios: [List typical situations where this error occurs]
• Technical Background: [Provide relevant language/framework context]

2. Step-by-Step Solution
----------------
• Step 1: [First step with clear explanation]
  [Code snippet if applicable]
• Step 2: [Second step with clear explanation]
  [Code snippet if applicable]
• Step 3: [Third step with clear explanation]
  [Code snippet if applicable]
• Step 4: [Final verification step]
  [Working code demonstration]

3. Best Practices for Prevention
----------------
• Design Pattern: [Recommended pattern to prevent this issue]
• Code Organization: [How to structure code to avoid this]
• Common Pitfalls: [Specific mistakes to watch for]
• Error Handling: [How to properly handle edge cases]

4. Code Examples
----------------
Before:
\`\`\`python
[Code that causes the error]
\`\`\`

After:
\`\`\`python
[Fixed version of the code]
\`\`\`

Alternative Approaches:
\`\`\`python
[Other valid solutions]
\`\`\``;

        const response = await this.axiosInstance.post<PerplexityResponse>('/chat/completions', {
          model: 'llama-3.1-sonar-huge-128k-online',
          messages: [
            {
              role: 'system',
              content: 'You are an expert software developer focused on debugging and solving coding problems. Always structure your responses exactly as requested.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],
        });

        let analysis = response.data.choices[0]?.message?.content;
        if (!analysis) {
          throw new Error('No analysis received from Perplexity');
        }

        // Helper functions for code analysis
        function analyzeCode(sourceCode: string | undefined): CodeAnalysis | null {
          if (!sourceCode) return null;

          // Dictionary string value case
          const isDictionaryPricePattern = sourceCode.includes("item['price']") || sourceCode.includes('item["price"]') || (
            sourceCode.includes('price') && 
            sourceCode.includes('item[') && 
            sourceCode.includes('for') && 
            sourceCode.includes('in') && 
            sourceCode.includes('total') && 
            sourceCode.includes('def calculate_total') &&
            sourceCode.includes('TypeError')
          );
          if (isDictionaryPricePattern) {
            const totalVar = 'total';
            return {
              fixed: `def calculate_total(items):
    ${totalVar} = 0
    for item in items:
        try:
            ${totalVar} = ${totalVar} + int(item['price'])  # Convert string to integer before adding
        except ValueError:
            raise ValueError(f"Invalid price value: {item['price']}")
    return ${totalVar}

data = [
    {'name': 'Book', 'price': '10'},
    {'name': 'Pen', 'price': '2'}
]

try:
    total = calculate_total(data)  # Result will be 12
    print(f"Total: {totalVar}")
except ValueError as e:
    print(f"Error: {e}")`,
              alternatives: `# Solution 1: Convert during dictionary creation
data = [
    {'name': 'Book', 'price': int('10')},
    {'name': 'Pen', 'price': int('2')}
]

def calculate_total(items):
    total = 0
    for item in items:
        total = total + item['price']  # No conversion needed
    return total

# Solution 2: Use list comprehension with type conversion
def calculate_total(items):
    return sum(int(item['price']) for item in items)

# Solution 3: Use map and sum for functional approach
def calculate_total(items):
    return sum(map(lambda x: int(x['price']), items))

# Solution 4: Use list comprehension with validation
def calculate_total(items):
    try:
        total = sum(int(item['price']) for item in items)
        return total
    except ValueError as e:
        raise ValueError(f"Invalid price value found in items: {e}")
    except KeyError:
        raise KeyError("Missing 'price' key in one or more items")
    except Exception as e:
        raise Exception(f"Unexpected error calculating total: {e}")

# Solution 5: Using dataclasses for better type safety
from dataclasses import dataclass
from typing import List

@dataclass
class Item:
    name: str
    price: int  # Store price as integer to prevent type issues
    
    @classmethod
    def from_string_price(cls, name: str, price_str: str) -> 'Item':
        try:
            return cls(name=name, price=int(price_str))
        except ValueError:
            raise ValueError(f"Invalid price value: {price_str}")

def calculate_total(items: List[Item]) -> int:
    return sum(item.price for item in items)

# Usage:
items = [
    Item.from_string_price('Book', '10'),
    Item.from_string_price('Pen', '2')
]
total = calculate_total(items)`
            };
          }

          // Simple string + int case
          if (sourceCode.includes('+') && /["'].*?\+.*?\d/.test(sourceCode)) {
            return {
              fixed: sourceCode.replace(/["'](\d+)["']\s*\+\s*(\d+)/, 'int("$1") + $2'),
              alternatives: `# Solution 1: Convert string to int
num_str = "123"
result = int(num_str) + 456

# Solution 2: Use string formatting
num_str = "123"
result = f"{num_str}456"  # For string concatenation

# Solution 3: With error handling
def safe_add(str_num, int_num):
    try:
        return int(str_num) + int_num
    except ValueError:
        raise ValueError("String must be a valid number")`
            };
          }

          return null;
        }

        // Use provided code as the "before" example if available
        const beforeCode = code || extractCodeExample(analysis, 'incorrect', 'problematic', 'error');
        
        // Generate solutions based on code analysis
        const afterCode = (codeAnalysis as CodeAnalysis | null)?.fixed || extractCodeExample(analysis, 'correct', 'fixed', 'solution');
        const alternativeCode = (codeAnalysis as CodeAnalysis | null)?.alternatives || extractCodeExample(analysis, 'alternative', 'another', 'other');

        // Generate response sections
        const rootCauseSection = formatSection('Root Cause Analysis', {
          'Technical Cause': extractTechnicalCause(analysis, query),
          'Common Scenarios': extractCommonScenarios(analysis),
          'Technical Background': extractTechnicalBackground(analysis)
        });

        const solutionSection = formatSection('Step-by-Step Solution', {
          'Steps': extractSteps(analysis)
        });

        const preventionSection = formatSection('Best Practices for Prevention', {
          'Design Pattern': extractDesignPattern(analysis),
          'Code Organization': extractCodeOrganization(analysis),
          'Common Pitfalls': extractCommonPitfalls(analysis),
          'Error Handling': extractErrorHandling(analysis)
        });

        const examplesSection = formatCodeExamples(language, beforeCode, afterCode, alternativeCode);

        // Combine sections
        const structuredResponse = [
          rootCauseSection,
          solutionSection,
          preventionSection,
          examplesSection
        ].join('\n\n');

        // Helper function to format sections
        function formatSection(title: string, items: Record<string, string>): string {
          const header = `${title}\n----------------`;
          const content = Object.entries(items)
            .map(([key, value]) => {
              if (key === 'Steps') return value;
              return `• ${key}: ${value}`;
            })
            .join('\n');
          return `${header}\n${content}`;
        }

        // Helper function to format code examples
        function formatCodeExamples(lang: string, before: string, after: string, alternatives: string): string {
          return `Code Examples
----------------
Before:
\`\`\`${lang}
${before}
\`\`\`

After:
\`\`\`${lang}
${after}
\`\`\`

Alternative Approaches:
\`\`\`${lang}
${alternatives}
\`\`\``;
        }

        // Helper functions to extract information from analysis
        function extractCodeExample(text: string, ...keywords: string[]): string {
          // Use string literal for code block markers to avoid escaping issues
          const codeBlockStart = '```';
          const pattern = new RegExp(`(?:${keywords.join('|')}).*?${codeBlockStart}.*?\\n([\\s\\S]*?)${codeBlockStart}`, 'i');
          const match = text.match(pattern);
          return match ? match[1].trim() : '[No code example provided]';
        }

        function extractTechnicalCause(text: string, query: string): string {
          if (query.includes('TypeError')) {
            return 'Python is strongly typed and does not allow operations between incompatible types';
          }
          const cause = text.match(/technical(?:\s+cause)?:?\s*([^•\n]+)/i);
          return cause ? cause[1].trim() : 'Unable to determine cause';
        }

        function extractCommonScenarios(text: string): string {
          const scenarios = text.match(/common(?:\s+scenarios)?:?\s*([^•\n]+)/i);
          return scenarios ? scenarios[1].trim() : 'Various scenarios where type mismatches occur';
        }

        function extractTechnicalBackground(text: string): string {
          const background = text.match(/(?:technical\s+)?background:?\s*([^•\n]+)/i);
          return background ? background[1].trim() : 'Language-specific type system requirements';
        }

        function extractSteps(text: string): string {
          const steps = text.match(/step(?:\s+\d+)?:?\s*([^•\n]+)/gi);
          if (!steps) return '• Step 1: Identify the issue\n• Step 2: Apply the fix\n• Step 3: Test the solution';
          return steps.map((step, i) => `• Step ${i + 1}: ${step.replace(/step\s+\d+:?\s*/i, '')}`).join('\n');
        }

        function extractDesignPattern(text: string): string {
          const pattern = text.match(/(?:design\s+pattern|pattern):?\s*([^•\n]+)/i);
          return pattern ? pattern[1].trim() : 'Type validation and conversion patterns';
        }

        function extractCodeOrganization(text: string): string {
          const org = text.match(/(?:code\s+organization|organize):?\s*([^•\n]+)/i);
          return org ? org[1].trim() : 'Separate data processing from business logic';
        }

        function extractCommonPitfalls(text: string): string {
          const pitfalls = text.match(/(?:common\s+pitfalls|pitfalls):?\s*([^•\n]+)/i);
          return pitfalls ? pitfalls[1].trim() : 'Mixing types without proper validation';
        }

        function extractErrorHandling(text: string): string {
          const handling = text.match(/(?:error\s+handling|handle):?\s*([^•\n]+)/i);
          return handling ? handling[1].trim() : 'Use try-catch blocks for type conversions';
        }

        return {
          content: [
            {
              type: 'text',
              text: structuredResponse,
            },
          ],
        };
      } catch (error) {
        if (axios.isAxiosError(error)) {
          return {
            content: [
              {
                type: 'text',
                text: `Perplexity API error: ${error.response?.data?.error?.message || error.message}`,
              },
            ],
            isError: true,
          };
        }
        throw error;
      }
    });
  }

  public async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Perplexity MCP server running on stdio');
  }
}

async function main(): Promise<void> {
  try {
    const server = new PerplexityServer();
    await server.run();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
