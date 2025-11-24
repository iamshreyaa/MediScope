import React, { useState, useContext } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../contexts/AuthContext";
import { Mail, Lock, User, Loader } from "lucide-react";
import styles from "./AuthPages.module.css";

const SignupPage = () => {
  const [userType, setUserType] = useState("patient");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    specialization: "",
    license_number: "",
    hospital_name: "",
    age: "",
    gender: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const { signUp } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
  const additionalData =
    userType === "doctor"
      ? {
          name: formData.name,
          specialization: formData.specialization,
          license_number: formData.license_number,
          hospital_name: formData.hospital_name,
        }
      : {
          name: formData.name,
          age: parseInt(formData.age),
          gender: formData.gender,
        };

  await signUp(formData.email, formData.password, userType, additionalData);

  alert("✅ Signup successful! Please log in.");
  navigate("/login"); // send them to login page
} catch (err) {
  setError(err.message || "Failed to sign up");
} finally {
  setLoading(false);
}

  };

  return (
    <div className={styles.authContainer}>
      <div className={styles.authCard}>
        <div className={styles.header}>
          <h1>Create Account</h1>
          <p>Join our healthcare platform</p>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.userTypeToggle}>
            <button
              type="button"
              className={`${styles.typeBtn} ${userType === "patient" ? styles.active : ""}`}
              onClick={() => setUserType("patient")}
            >
              Patient
            </button>
            <button
              type="button"
              className={`${styles.typeBtn} ${userType === "doctor" ? styles.active : ""}`}
              onClick={() => setUserType("doctor")}
            >
              Doctor
            </button>
          </div>

          <div className={styles.formGroup}>
            <label>Full Name</label>
            <div className={styles.inputWrapper}>
              <User size={18} />
              <input type="text" name="name" value={formData.name} onChange={handleChange} required />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Email</label>
            <div className={styles.inputWrapper}>
              <Mail size={18} />
              <input type="email" name="email" value={formData.email} onChange={handleChange} required />
            </div>
          </div>

          {userType === "doctor" ? (
            <>
              <div className={styles.formGroup}>
                <label>Specialization</label>
                <input type="text" name="specialization" value={formData.specialization} onChange={handleChange} />
              </div>

              <div className={styles.formGroup}>
                <label>License Number</label>
                <input type="text" name="license_number" value={formData.license_number} onChange={handleChange} />
              </div>

              <div className={styles.formGroup}>
                <label>Hospital Name</label>
                <input type="text" name="hospital_name" value={formData.hospital_name} onChange={handleChange} />
              </div>
            </>
          ) : (
            <>
              <div className={styles.formGroup}>
                <label>Age</label>
                <input type="number" name="age" value={formData.age} onChange={handleChange} />
              </div>

              <div className={styles.formGroup}>
                <label>Gender</label>
                <select name="gender" value={formData.gender} onChange={handleChange}>
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </>
          )}

          <div className={styles.formGroup}>
            <label>Password</label>
            <div className={styles.inputWrapper}>
              <Lock size={18} />
              <input type="password" name="password" value={formData.password} onChange={handleChange} required />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label>Confirm Password</label>
            <div className={styles.inputWrapper}>
              <Lock size={18} />
              <input type="password" name="confirmPassword" value={formData.confirmPassword} onChange={handleChange} required />
            </div>
          </div>

          <button type="submit" className={styles.submitBtn} disabled={loading}>
            {loading ? <><Loader size={18} className={styles.spinner}/> Creating account...</> : "Sign Up"}
          </button>
        </form>

        <div className={styles.footer}>
          <p>Already have an account? <a href="/login">Sign in</a></p>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
