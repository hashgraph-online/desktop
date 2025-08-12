import { MCPServerType } from '../types/mcp'

export interface FieldError {
  field: string
  message: string
}

export interface ValidationHelpers {
  validateField: (field: string, value: any) => FieldError | null
  getFieldRequirements: (field: string) => string
}

/**
 * Client-side validation helpers for MCP server forms
 */
export class MCPServerFormValidator {
  /**
   * Get validation helpers for a specific server type
   */
  static getValidationHelpers(serverType: MCPServerType): ValidationHelpers {
    switch (serverType) {
      case 'filesystem':
        return this.getFilesystemValidators()
      case 'github':
        return this.getGitHubValidators()
      case 'postgres':
        return this.getPostgresValidators()
      case 'sqlite':
        return this.getSQLiteValidators()
      case 'custom':
        return this.getCustomValidators()
      default:
        return this.getDefaultValidators()
    }
  }

  /**
   * Filesystem server validators
   */
  private static getFilesystemValidators(): ValidationHelpers {
    return {
      validateField: (field: string, value: any): FieldError | null => {
        switch (field) {
          case 'rootPath':
            if (!value || value.trim() === '') {
              return { field, message: 'Root path is required' }
            }
            if (!value.startsWith('/') && !value.match(/^[A-Za-z]:\\/)) {
              return { field, message: 'Please use an absolute path' }
            }
            return null
          
          case 'allowedPaths':
          case 'excludePaths':
            if (value) {
              const paths = value.split(',').map((p: string) => p.trim()).filter(Boolean)
              for (const path of paths) {
                if (!path.startsWith('/') && !path.match(/^[A-Za-z]:\\/)) {
                  return { field, message: 'All paths should be absolute' }
                }
              }
            }
            return null
          
          default:
            return null
        }
      },
      getFieldRequirements: (field: string): string => {
        switch (field) {
          case 'rootPath':
            return 'Required. Must be an absolute path to a directory'
          case 'allowedPaths':
            return 'Optional. Comma-separated list of absolute paths'
          case 'excludePaths':
            return 'Optional. Comma-separated list of absolute paths to exclude'
          default:
            return ''
        }
      }
    }
  }

  /**
   * GitHub server validators
   */
  private static getGitHubValidators(): ValidationHelpers {
    return {
      validateField: (field: string, value: any): FieldError | null => {
        switch (field) {
          case 'token':
            if (!value || value.trim() === '') {
              return { field, message: 'GitHub token is required' }
            }
            if (!value.match(/^(ghp|gho|ghu|ghs)_[a-zA-Z0-9]+$/)) {
              return { field, message: 'Invalid GitHub token format. Should start with ghp_, gho_, ghu_, or ghs_' }
            }
            return null
          
          case 'owner':
            if (value && !value.match(/^[\w\-\.]+$/)) {
              return { field, message: 'Invalid username/organization format' }
            }
            return null
          
          case 'repo':
            if (value && !value.match(/^[\w\-\.]+$/)) {
              return { field, message: 'Invalid repository name format' }
            }
            return null
          
          case 'branch':
            if (value && !value.match(/^[\w\-\.\/]+$/)) {
              return { field, message: 'Invalid branch name format' }
            }
            return null
          
          default:
            return null
        }
      },
      getFieldRequirements: (field: string): string => {
        switch (field) {
          case 'token':
            return 'Required. Personal access token from GitHub settings'
          case 'owner':
            return 'Optional. GitHub username or organization'
          case 'repo':
            return 'Optional. Repository name'
          case 'branch':
            return 'Optional. Branch name (defaults to main)'
          default:
            return ''
        }
      }
    }
  }

  /**
   * PostgreSQL server validators
   */
  private static getPostgresValidators(): ValidationHelpers {
    return {
      validateField: (field: string, value: any): FieldError | null => {
        switch (field) {
          case 'host':
            if (!value || value.trim() === '') {
              return { field, message: 'Host is required' }
            }
            if (!value.match(/^[a-zA-Z0-9\-\.]+$/) && !value.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/)) {
              return { field, message: 'Invalid hostname or IP address' }
            }
            return null
          
          case 'port':
            const portNum = typeof value === 'string' ? parseInt(value, 10) : value
            if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
              return { field, message: 'Port must be between 1 and 65535' }
            }
            return null
          
          case 'database':
            if (!value || value.trim() === '') {
              return { field, message: 'Database name is required' }
            }
            if (!value.match(/^[\w\-]+$/)) {
              return { field, message: 'Invalid database name format' }
            }
            return null
          
          case 'username':
            if (!value || value.trim() === '') {
              return { field, message: 'Username is required' }
            }
            return null
          
          case 'password':
            if (!value || value.trim() === '') {
              return { field, message: 'Password is required' }
            }
            return null
          
          default:
            return null
        }
      },
      getFieldRequirements: (field: string): string => {
        switch (field) {
          case 'host':
            return 'Required. PostgreSQL server hostname or IP address'
          case 'port':
            return 'Required. Port number (default: 5432)'
          case 'database':
            return 'Required. Database name to connect to'
          case 'username':
            return 'Required. PostgreSQL username'
          case 'password':
            return 'Required. PostgreSQL password'
          case 'ssl':
            return 'Optional. Enable SSL connection'
          default:
            return ''
        }
      }
    }
  }

  /**
   * SQLite server validators
   */
  private static getSQLiteValidators(): ValidationHelpers {
    return {
      validateField: (field: string, value: any): FieldError | null => {
        switch (field) {
          case 'path':
            if (!value || value.trim() === '') {
              return { field, message: 'Database path is required' }
            }
            if (!value.startsWith('/') && !value.match(/^[A-Za-z]:\\/)) {
              return { field, message: 'Please use an absolute path' }
            }
            if (!value.match(/\.(db|sqlite|sqlite3)$/i)) {
              return { field, message: 'File should have .db, .sqlite, or .sqlite3 extension' }
            }
            return null
          
          default:
            return null
        }
      },
      getFieldRequirements: (field: string): string => {
        switch (field) {
          case 'path':
            return 'Required. Absolute path to SQLite database file'
          case 'readOnly':
            return 'Optional. Open database in read-only mode'
          default:
            return ''
        }
      }
    }
  }

  /**
   * Custom server validators
   */
  private static getCustomValidators(): ValidationHelpers {
    return {
      validateField: (field: string, value: any): FieldError | null => {
        switch (field) {
          case 'command':
            if (!value || value.trim() === '') {
              return { field, message: 'Command is required' }
            }
            return null
          
          case 'env':
            if (value) {
              const lines = value.split('\n').filter(Boolean)
              for (const line of lines) {
                if (!line.includes('=')) {
                  return { field, message: 'Each line should be in KEY=value format' }
                }
                const [key] = line.split('=', 1)
                if (!key.match(/^[a-zA-Z_][a-zA-Z0-9_]*$/)) {
                  return { field, message: `Invalid environment variable name: ${key}` }
                }
              }
            }
            return null
          
          case 'cwd':
            if (value) {
              if (!value.startsWith('/') && !value.match(/^[A-Za-z]:\\/)) {
                return { field, message: 'Working directory should be an absolute path' }
              }
            }
            return null
          
          default:
            return null
        }
      },
      getFieldRequirements: (field: string): string => {
        switch (field) {
          case 'command':
            return 'Required. Command to execute the MCP server'
          case 'args':
            return 'Optional. Space-separated command arguments'
          case 'env':
            return 'Optional. Environment variables (one per line, KEY=value format)'
          case 'cwd':
            return 'Optional. Working directory (absolute path)'
          default:
            return ''
        }
      }
    }
  }

  /**
   * Default validators for common fields
   */
  private static getDefaultValidators(): ValidationHelpers {
    return {
      validateField: (field: string, value: any): FieldError | null => {
        switch (field) {
          case 'name':
            if (!value || value.trim() === '') {
              return { field, message: 'Server name is required' }
            }
            if (value.length > 50) {
              return { field, message: 'Server name must be 50 characters or less' }
            }
            if (!value.match(/^[\w\s\-\.]+$/)) {
              return { field, message: 'Server name can only contain letters, numbers, spaces, hyphens, and dots' }
            }
            return null
          
          default:
            return null
        }
      },
      getFieldRequirements: (field: string): string => {
        switch (field) {
          case 'name':
            return 'Required. A descriptive name for the server'
          default:
            return ''
        }
      }
    }
  }

  /**
   * Validate all fields for a server type
   */
  static validateAllFields(serverType: MCPServerType, formData: Record<string, any>): FieldError[] {
    const errors: FieldError[] = []
    const validators = this.getValidationHelpers(serverType)
    const defaultValidators = this.getDefaultValidators()

    const nameError = defaultValidators.validateField('name', formData.name)
    if (nameError) errors.push(nameError)

    const fieldsToValidate = this.getFieldsForType(serverType)
    for (const field of fieldsToValidate) {
      const error = validators.validateField(field, formData[field])
      if (error) errors.push(error)
    }

    return errors
  }

  /**
   * Get list of fields to validate for a server type
   */
  private static getFieldsForType(serverType: MCPServerType): string[] {
    switch (serverType) {
      case 'filesystem':
        return ['rootPath', 'allowedPaths', 'excludePaths']
      case 'github':
        return ['token', 'owner', 'repo', 'branch']
      case 'postgres':
        return ['host', 'port', 'database', 'username', 'password']
      case 'sqlite':
        return ['path']
      case 'custom':
        return ['command', 'args', 'env', 'cwd']
      default:
        return []
    }
  }

  /**
   * Get all field requirements for a server type
   */
  static getAllFieldRequirements(serverType: MCPServerType): Record<string, string> {
    const requirements: Record<string, string> = {}
    const validators = this.getValidationHelpers(serverType)
    const defaultValidators = this.getDefaultValidators()
    
    requirements.name = defaultValidators.getFieldRequirements('name')
    
    const fields = this.getFieldsForType(serverType)
    for (const field of fields) {
      requirements[field] = validators.getFieldRequirements(field)
    }
    
    return requirements
  }
}