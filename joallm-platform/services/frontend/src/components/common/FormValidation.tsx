import React, { useState, useEffect, useCallback } from 'react';
import { ValidationUtils, ValidationError, ValidationResult } from '../../utils/validation';

interface FormFieldProps {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'password' | 'textarea' | 'file';
  value: any;
  onChange: (value: any) => void;
  onBlur?: () => void;
  placeholder?: string;
  required?: boolean;
  validator?: (value: any) => ValidationResult;
  error?: string;
  disabled?: boolean;
  className?: string;
  rows?: number;
  accept?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  name,
  label,
  type = 'text',
  value,
  onChange,
  onBlur,
  placeholder,
  required = false,
  validator,
  error,
  disabled = false,
  className = '',
  rows = 3,
  accept
}) => {
  const [isTouched, setIsTouched] = useState(false);
  const [fieldError, setFieldError] = useState<string>('');

  const validateField = useCallback((value: any) => {
    if (validator) {
      const result = validator(value);
      setFieldError(result.isValid ? '' : result.errors[0]?.message || '');
      return result.isValid;
    }
    return true;
  }, [validator]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const newValue = type === 'file' ? e.target.files?.[0] : e.target.value;
    onChange(newValue);
    
    if (isTouched) {
      validateField(newValue);
    }
  };

  const handleBlur = () => {
    setIsTouched(true);
    validateField(value);
    onBlur?.();
  };

  useEffect(() => {
    if (isTouched) {
      validateField(value);
    }
  }, [value, isTouched, validateField]);

  const displayError = error || fieldError;
  const hasError = Boolean(displayError);

  const inputClasses = `
    w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
    ${hasError ? 'border-red-500 focus:ring-red-500 focus:border-red-500' : 'border-gray-300'}
    ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
    ${className}
  `.trim();

  return (
    <div className="mb-4">
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      
      {type === 'textarea' ? (
        <textarea
          id={name}
          name={name}
          value={value || ''}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          rows={rows}
          className={inputClasses}
        />
      ) : type === 'file' ? (
        <input
          id={name}
          name={name}
          type="file"
          onChange={handleChange}
          onBlur={handleBlur}
          disabled={disabled}
          accept={accept}
          className={inputClasses}
        />
      ) : (
        <input
          id={name}
          name={name}
          type={type}
          value={value || ''}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          disabled={disabled}
          className={inputClasses}
        />
      )}
      
      {hasError && (
        <p className="mt-1 text-sm text-red-600">{displayError}</p>
      )}
    </div>
  );
};

interface FormProps {
  onSubmit: (data: any) => void;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export const Form: React.FC<FormProps> = ({
  onSubmit,
  children,
  className = '',
  disabled = false
}) => {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!disabled) {
      const formData = new FormData(e.target as HTMLFormElement);
      const data = Object.fromEntries(formData.entries());
      onSubmit(data);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      {children}
    </form>
  );
};

interface ValidationFormProps<T> {
  initialData: T;
  validators: Record<keyof T, (value: any) => ValidationResult>;
  onSubmit: (data: T) => void;
  children: (props: {
    data: T;
    errors: ValidationError[];
    setFieldValue: (field: keyof T, value: any) => void;
    setFieldTouched: (field: keyof T) => void;
    getFieldError: (field: keyof T) => string;
    hasFieldError: (field: keyof T) => boolean;
    isValid: boolean;
    validateForm: () => boolean;
  }) => React.ReactNode;
  className?: string;
}

export function ValidationForm<T extends Record<string, any>>({
  initialData,
  validators,
  onSubmit,
  children,
  className = ''
}: ValidationFormProps<T>) {
  const [data, setData] = useState<T>(initialData);
  const [errors, setErrors] = useState<ValidationError[]>([]);
  const [touched, setTouched] = useState<Record<keyof T, boolean>>({} as Record<keyof T, boolean>);

  const validateField = useCallback((field: keyof T, value: any) => {
    const result = validators[field](value);
    setErrors(prev => {
      const newErrors = prev.filter(error => error.field !== field);
      return [...newErrors, ...result.errors];
    });
    return result.isValid;
  }, [validators]);

  const validateForm = useCallback(() => {
    const result = ValidationUtils.validateForm(data, validators);
    setErrors(result.errors);
    return result.isValid;
  }, [data, validators]);

  const setFieldValue = useCallback((field: keyof T, value: any) => {
    setData(prev => ({ ...prev, [field]: value }));
    setTouched(prev => ({ ...prev, [field]: true }));
    
    if (touched[field]) {
      validateField(field, value);
    }
  }, [touched, validateField]);

  const setFieldTouched = useCallback((field: keyof T) => {
    setTouched(prev => ({ ...prev, [field]: true }));
    validateField(field, data[field]);
  }, [data, validateField]);

  const getFieldError = useCallback((field: keyof T) => {
    return errors.find(error => error.field === field)?.message;
  }, [errors]);

  const hasFieldError = useCallback((field: keyof T) => {
    return errors.some(error => error.field === field);
  }, [errors]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(data);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={className}>
      {children({
        data,
        errors,
        setFieldValue,
        setFieldTouched,
        getFieldError,
        hasFieldError,
        isValid: errors.length === 0,
        validateForm
      })}
    </form>
  );
}

// Pre-built form components for common use cases
export const LoginForm: React.FC<{
  onSubmit: (data: { email: string; password: string }) => void;
  loading?: boolean;
}> = ({ onSubmit, loading = false }) => {
  const [formData, setFormData] = React.useState({ email: '', password: '' });
  const [errors, setErrors] = React.useState<ValidationError[]>([]);
  const [touched, setTouched] = React.useState({ email: false, password: false });

  const validateField = (field: keyof typeof formData, value: string) => {
    let result: ValidationResult;
    
    if (field === 'email') {
      result = ValidationUtils.validateEmail(value);
    } else if (field === 'password') {
      result = ValidationUtils.validatePassword(value);
    } else {
      result = { isValid: true, errors: [] };
    }

    setErrors(prev => {
      const newErrors = prev.filter(error => error.field !== field);
      return [...newErrors, ...result.errors];
    });

    return result.isValid;
  };

  const setFieldValue = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setTouched(prev => ({ ...prev, [field]: true }));
    
    if (touched[field]) {
      validateField(field, value);
    }
  };

  const getFieldError = (field: keyof typeof formData) => {
    return errors.find(error => error.field === field)?.message;
  };

  const validateForm = () => {
    const emailValid = validateField('email', formData.email);
    const passwordValid = validateField('password', formData.password);
    return emailValid && passwordValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField
        name="email"
        label="Email"
        type="email"
        value={formData.email}
        onChange={(value) => setFieldValue('email', value)}
        placeholder="Enter your email"
        required
        error={getFieldError('email')}
        disabled={loading}
      />
      
      <FormField
        name="password"
        label="Password"
        type="password"
        value={formData.password}
        onChange={(value) => setFieldValue('password', value)}
        placeholder="Enter your password"
        required
        error={getFieldError('password')}
        disabled={loading}
      />
      
      <button
        type="submit"
        disabled={errors.length > 0 || loading}
        className="w-full bg-joa-primary text-white py-2 px-4 rounded-md hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-joa-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Signing in...' : 'Sign In'}
      </button>
    </form>
  );
};

export const RegisterForm: React.FC<{
  onSubmit: (data: { email: string; password: string; name: string }) => void;
  loading?: boolean;
}> = ({ onSubmit, loading = false }) => {
  return (
    <ValidationForm
      initialData={{ email: '', password: '', name: '' }}
      validators={{
        email: ValidationUtils.validateEmail,
        password: ValidationUtils.validatePassword,
        name: ValidationUtils.validateName
      }}
      onSubmit={onSubmit}
    >
      {({ data, setFieldValue, getFieldError, isValid }) => (
        <>
          <FormField
            name="name"
            label="Full Name"
            type="text"
            value={data.name}
            onChange={(value) => setFieldValue('name', value)}
            placeholder="Enter your full name"
            required
            error={getFieldError('name')}
            disabled={loading}
          />
          
          <FormField
            name="email"
            label="Email"
            type="email"
            value={data.email}
            onChange={(value) => setFieldValue('email', value)}
            placeholder="Enter your email"
            required
            error={getFieldError('email')}
            disabled={loading}
          />
          
          <FormField
            name="password"
            label="Password"
            type="password"
            value={data.password}
            onChange={(value) => setFieldValue('password', value)}
            placeholder="Enter your password"
            required
            error={getFieldError('password')}
            disabled={loading}
          />
          
          <button
            type="submit"
            disabled={!isValid || loading}
            className="w-full bg-joa-primary text-white py-2 px-4 rounded-md hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-joa-primary focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </>
      )}
    </ValidationForm>
  );
};

export const FileUploadForm: React.FC<{
  onSubmit: (file: File) => void;
  loading?: boolean;
  accept?: string;
}> = ({ onSubmit, loading = false, accept }) => {
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string>('');

  const handleFileChange = (selectedFile: File | null) => {
    setFile(selectedFile);
    setError('');
    
    if (selectedFile) {
      const result = ValidationUtils.validateFile(selectedFile);
      if (!result.isValid) {
        setError(result.errors[0]?.message || 'Invalid file');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (file && !error) {
      onSubmit(file);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <FormField
        name="file"
        label="Upload File"
        type="file"
        value={file}
        onChange={handleFileChange}
        accept={accept}
        error={error}
        disabled={loading}
      />
      
      <button
        type="submit"
        disabled={!file || !!error || loading}
        className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Uploading...' : 'Upload File'}
      </button>
    </form>
  );
};

export const SearchForm: React.FC<{
  onSubmit: (query: string) => void;
  loading?: boolean;
  placeholder?: string;
}> = ({ onSubmit, loading = false, placeholder = "Search..." }) => {
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string>('');

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setError('');
    
    const result = ValidationUtils.validateSearchQuery(value);
    if (!result.isValid) {
      setError(result.errors[0]?.message || 'Invalid search query');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query && !error) {
      onSubmit(query);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="flex-1">
        <FormField
          name="query"
          label=""
          type="text"
          value={query}
          onChange={handleQueryChange}
          placeholder={placeholder}
          error={error}
          disabled={loading}
          className="mb-0"
        />
      </div>
      
      <button
        type="submit"
        disabled={!query || !!error || loading}
        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Searching...' : 'Search'}
      </button>
    </form>
  );
};
