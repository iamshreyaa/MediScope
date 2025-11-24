import React, { useState, useContext, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../contexts/AuthContext";
import { Mail, Lock, Loader } from "lucide-react";
import styles from "./AuthPages.module.css";

const LoginPage = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userType, setUserType] = useState("patient");

  const { signIn } = useContext(AuthContext);
  const navigate = useNavigate();

  useEffect(() => {
    const storedRole = localStorage.getItem("userType");
    if (storedRole) setUserType(storedRole);
  }, []);

  const handleSubmit = async (e) => {
  e.preventDefault();
  setError("");
  setLoading(true);

  try {
    const userData = await signIn(email, password);
    console.log("Logged in user data:", userData);

    const role = (userData.role || "").toLowerCase();

    if (role === "doctor") {
      navigate("/doctor/dashboard");
    } else if (role === "patient") {
      navigate("/patient/dashboard");
    } else {
      setError("Unknown role, cannot redirect");
      return;
    }
  } catch (err) {
    setError(err.message || "Failed to login");
  } finally {
    setLoading(false);
  }
};



  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.header}>
          <h1>Welcome Back</h1>
          <p>Sign in to your account</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          

          <div className={styles.formGroup}>
            <label>Email</label>
            <div className={styles.inputWrapper}>
              <Mail size={18} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Password</label>
            <div className={styles.inputWrapper}>
              <Lock size={18} />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? <><Loader size={18} className={styles.spinner}/> Signing in...</> : "Sign In"}
          </button>
        </form>

        <p>Don't have an account? <a href="/signup">Sign Up</a></p>
      </div>
    </div>
  );
};

export default LoginPage;
