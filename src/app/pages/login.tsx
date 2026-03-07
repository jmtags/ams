import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import logo from '../assets/logo.avif'; // ✅ import logo

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const user = await login({ email, password });

      if (!user) {
        throw new Error('Login failed');
      }

      if (user.role === 'admin') {
        navigate('/admin');
      } else {
        navigate('/dashboard');
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        
        <CardHeader className="text-center">
          
          {/* ✅ Logo */}
          <div className="flex justify-center mb-4">
            <img
              src={logo}
              alt="System Logo"
              className="h-60 w-auto"
            />
          </div>

          <CardTitle>Attendance Monitoring System</CardTitle>
          <CardDescription>
            Sign in to your account to continue
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">

            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
              disabled={isLoading}
            />

            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
              disabled={isLoading}
            />

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>

          </form>

          <div className="mt-6 p-4 bg-neutral-100 rounded-lg text-sm text-neutral-700">
            <p className="mb-2"></p>
          </div>

        </CardContent>
      </Card>
    </div>
  );
}