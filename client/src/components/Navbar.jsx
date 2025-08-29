import NavItem from "./NavItem";
import { useState } from "react";


const Navbar = () => {

    const [isLoggedIn, setIsloggedIn] = useState();

    const items = [
        {id: 1, value: 'Home', path: '/'},
        {id: 2, value: 'Video List', path: '/video-list'},
        {id: 3, value: 'Download', path: '/download'},
    ]
    return (
      <nav>
        <ul>
          {items.map((item) => (
            <NavItem key={item.id} id={item.id} value={item.value} path={item.path} />
          ))}
        </ul>
        <ul>
            { isLoggedIn 
                ? <NavItem id={4} value='Logout' path='/logout'/> 
                : <div>
                    <NavItem id={4} value='Login' path='/login'/> 
                    <NavItem id={5} value='Sign up' path='/signup'/>
                </div>
            }
        </ul>
      </nav>
    );
}

export default Navbar;