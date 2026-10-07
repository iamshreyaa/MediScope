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

  alert("Signup successful! Please log in.");
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

          <div className={`${styles.formGroup} ${formData.name ? 'filled' : ''}`}>
            <div className={styles.inputWrapper}>
              <User size={18} aria-hidden="true" />
              <input id="name" name="name" type="text" value={formData.name} onChange={handleChange} placeholder=" " required />
              <label htmlFor="name">Full Name</label>
            </div>
          </div>

          <div className={`${styles.formGroup} ${formData.email ? 'filled' : ''}`}>
            <div className={styles.inputWrapper}>
              <Mail size={18} aria-hidden="true" />
              <input id="email" name="email" type="email" value={formData.email} onChange={handleChange} placeholder=" " required />
              <label htmlFor="email">Email</label>
            </div>
          </div>

          {userType === "doctor" ? (
            <>
              <div className={`${styles.formGroup} ${formData.specialization ? 'filled' : ''}`}>
                <div className={styles.inputWrapper}>
                  <input id="specialization" name="specialization" type="text" value={formData.specialization} onChange={handleChange} placeholder=" " />
                  <label htmlFor="specialization">Specialization</label>
                </div>
              </div>

              <div className={`${styles.formGroup} ${formData.license_number ? 'filled' : ''}`}>
                <div className={styles.inputWrapper}>
                  <input id="license_number" name="license_number" type="text" value={formData.license_number} onChange={handleChange} placeholder=" " />
                  <label htmlFor="license_number">License Number</label>
                </div>
              </div>

              <div className={`${styles.formGroup} ${formData.hospital_name ? 'filled' : ''}`}>
                <div className={styles.inputWrapper}>
                  <input id="hospital_name" name="hospital_name" type="text" value={formData.hospital_name} onChange={handleChange} placeholder=" " />
                  <label htmlFor="hospital_name">Hospital Name</label>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className={`${styles.formGroup} ${formData.age ? 'filled' : ''}`}>
                <div className={styles.inputWrapper}>
                  <input id="age" name="age" type="number" value={formData.age} onChange={handleChange} placeholder=" " />
                  <label htmlFor="age">Age</label>
                </div>
              </div>

              <div className={`${styles.formGroup} ${formData.gender ? 'filled' : ''}`}>
                <div className={styles.inputWrapper}>
                  <select id="gender" name="gender" value={formData.gender} onChange={handleChange} placeholder=" ">
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                  <label htmlFor="gender">Gender</label>
                </div>
              </div>
            </>
          )}

          <div className={`${styles.formGroup} ${formData.password ? 'filled' : ''}`}>
            <div className={styles.inputWrapper}>
              <Lock size={18} aria-hidden="true" />
              <input id="password" name="password" type="password" value={formData.password} onChange={handleChange} placeholder=" " required />
              <label htmlFor="password">Password</label>
            </div>
          </div>

          <div className={`${styles.formGroup} ${formData.confirmPassword ? 'filled' : ''}`}>
            <div className={styles.inputWrapper}>
              <Lock size={18} aria-hidden="true" />
              <input id="confirmPassword" name="confirmPassword" type="password" value={formData.confirmPassword} onChange={handleChange} placeholder=" " required />
              <label htmlFor="confirmPassword">Confirm Password</label>
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
