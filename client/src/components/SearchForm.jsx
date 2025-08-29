
const SearchForm = ({onChange, onSubmit, searchString}) => {

    return (
        <form onSubmit={onSubmit}>
            <input type="text" placeholder="Search for public videos" onChange={(e) => onChange(e.target.value)} value={searchString}/>
            <button type="submit">Search</button>
        </form>
    )
}

export default SearchForm;