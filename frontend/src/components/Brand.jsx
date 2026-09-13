import logo from '../assets/logo.png'

export default function Brand({ onClick }) {
  const content = <><img className="brand-logo" src={logo} alt="FASALYNK" /><span>FASALYNK</span></>
  return onClick ? <button className="brand brand-button" type="button" onClick={onClick}>{content}</button> : <a className="brand" href="/">{content}</a>
}
