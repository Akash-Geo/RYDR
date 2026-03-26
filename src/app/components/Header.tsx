import { Link, useLocation } from 'react-router-dom';
import { Leaf, User, Wallet, Car, ShieldCheck, Menu, X, Moon, Sun } from 'lucide-react';
import { Button } from './ui/button';
import { useState, useEffect } from 'react';

export function Header() {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const navLinks = [
    { path: '/', label: 'Find Rides', icon: Car, active: isActive('/') && !isActive('/rides') },
    { path: '/offer', label: 'Offer Ride', icon: Car, active: isActive('/offer') },
    { path: '/wallet', label: 'Wallet', icon: Wallet, active: isActive('/wallet') },
    { path: '/admin', label: 'Admin', icon: ShieldCheck, active: isActive('/admin') },
  ];

  return (
    <header className="sticky top-0 z-50 w-full bg-white/90 dark:bg-gray-900/90 backdrop-blur-lg border-b border-gray-200 dark:border-gray-800">
      <div className="container mx-auto px-4 lg:px-8">
        <div className="flex h-16 md:h-20 items-center justify-between">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-[#00C853] to-emerald-600 flex items-center justify-center shadow-lg">
              <Leaf className="w-5 h-5 md:w-7 md:h-7 text-white" />
            </div>
            <span className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-[#00C853] to-emerald-700 bg-clip-text text-transparent">
              RYDR
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center gap-2">
            {navLinks.map((link) => (
              <Link key={link.path} to={link.path}>
                <Button 
                  variant={link.active ? "default" : "ghost"}
                  size="lg"
                  className={`${link.active ? "bg-[#00C853] hover:bg-emerald-600 text-white" : "dark:text-gray-200"} text-base px-6`}
                >
                  <link.icon className="w-5 h-5 mr-2" />
                  {link.label}
                </Button>
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-[#00C853]/10 to-emerald-100 dark:from-[#00C853]/20 dark:to-emerald-900/30 rounded-xl">
              <Wallet className="w-5 h-5 text-[#00C853]" />
              <span className="font-semibold text-gray-800 dark:text-white">2,710 Pts</span>
            </div>
            
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full w-10 h-10 md:w-12 md:h-12"
              onClick={() => setDarkMode(!darkMode)}
            >
              {darkMode ? <Sun className="w-5 h-5 md:w-6 md:h-6" /> : <Moon className="w-5 h-5 md:w-6 md:h-6" />}
            </Button>

            <Link to="/login" className="hidden md:block">
              <Button variant="outline" size="lg" className="dark:border-gray-700 dark:text-gray-300">
                Log In
              </Button>
            </Link>

            <Button variant="ghost" size="icon" className="rounded-full w-10 h-10 md:w-12 md:h-12">
              <User className="w-5 h-5 md:w-6 md:h-6" />
            </Button>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden rounded-full w-10 h-10 md:w-12 md:h-12"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden pb-4 border-t border-gray-200 dark:border-gray-800 mt-4">
            <nav className="flex flex-col gap-2 pt-4">
              {navLinks.map((link) => (
                <Link key={link.path} to={link.path} onClick={() => setMobileMenuOpen(false)}>
                  <Button 
                    variant={link.active ? "default" : "ghost"}
                    size="lg"
                    className={`w-full justify-start ${link.active ? "bg-[#00C853] hover:bg-emerald-600 text-white" : "dark:text-gray-200"} text-lg h-14`}
                  >
                    <link.icon className="w-6 h-6 mr-3" />
                    {link.label}
                  </Button>
                </Link>
              ))}
              <div className="sm:hidden mt-2 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-[#00C853]/10 to-emerald-100 dark:from-[#00C853]/20 dark:to-emerald-900/30 rounded-xl">
                <Wallet className="w-5 h-5 text-[#00C853]" />
                <span className="font-semibold text-gray-800 dark:text-white">2,710 Points</span>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}