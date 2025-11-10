#!/usr/bin/env sh
if [ -z "$husky_skip_init" ]; then
  if [ "$HUSKY" = 0 ]; then
    return
  fi
  husky_skip_init=1
  export husky_skip_init

  sh -e "$0" "$@"
  exitCode=$?

  unset husky_skip_init
  return $exitCode
fi
