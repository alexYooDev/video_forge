import { Link } from "react-router-dom";

const NavItem = ({id, value, path}) => {
    return (
        <li id={id}>
            <Link to={path}>{value}</Link>
        </li>
    )
}

export default NavItem;