function findHumanAge(date) {
  if (Math.floor((new Date() - date) / 1000) / 31536000 > 1) {
    return (
      Math.floor(Math.floor((new Date() - date) / 1000) / 31536000) +
      " year(s) ago"
    );
  } else if (Math.floor((new Date() - date) / 1000) / 2592000 > 1) {
    return (
      Math.floor(Math.floor((new Date() - date) / 1000) / 2592000) +
      " month(s) ago"
    );
  } else if (Math.floor((new Date() - date) / 1000) / 86400 > 1) {
    return (
      Math.floor(Math.floor((new Date() - date) / 1000) / 86400) + " day(s) ago"
    );
  } else if (Math.floor((new Date() - date) / 1000) / 3600 > 1) {
    return (
      Math.floor(Math.floor((new Date() - date) / 1000) / 3600) + " hour(s) ago"
    );
  } else if (Math.floor((new Date() - date) / 1000) / 60 > 1) {
    return (
      Math.floor(Math.floor((new Date() - date) / 1000) / 60) + " minute(s) ago"
    );
  } else {
    return Math.floor((new Date() - date) / 1000) + " second(s) ago";
  }
}
module.exports = { findHumanAge: findHumanAge };
