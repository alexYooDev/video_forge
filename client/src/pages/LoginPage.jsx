
import { useState } from "react";

const LoginPage = () => {


    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        const requestURL = `${process.env.REACT_APP_DEV_SERVER_URL}/login`;
        const response = await fetch(requestURL, {
            method: "POST",
            body: JSON.stringify({email, password})
        });

        if (!response.ok) {
            throw new Error(`HTTP error, status: ${response.status}`);
        }
        
        const data = await response;

        console.log(data);
    }

    const handleChangeEmail = (e) => {
        setEmail(e.target.value);
    };

    const handleChangePassword = (e) => {
        setPassword(e.target.value);
    }

    return (
      <main>
        <div>
          <form onSubmit={handleLogin}>
            <input
              type='text'
              placeholder='Enter your email'
              onChange={handleChangeEmail}
              value={email}
            />
            <input
              type='password'
              placeholder='Enter your password'
              onChange={handleChangePassword}
              value={password}
            />
            <button>Log in</button>
          </form>
        </div>
      </main>
    );
}

export default LoginPage;