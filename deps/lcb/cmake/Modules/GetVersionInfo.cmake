# Gets the libcouchbase version
# Sets:
#  LCB_VERSION: Version string
#  LCB_CHANGESET: SCM Revision number
#  LCB_VERSION_HEX Numeric hex version
#  LCB_VERSION_MAJOR
#  LCB_VERSION_MINOR
#  LCB_VERSION_PATCH

## Try git first ##
FIND_PROGRAM(GIT_EXECUTABLE NAMES git git.exe)
MACRO(RUNGIT outvar)
    EXECUTE_PROCESS(COMMAND git ${ARGN}
        OUTPUT_VARIABLE ${outvar}
        WORKING_DIRECTORY ${PROJECT_SOURCE_DIR}
        OUTPUT_STRIP_TRAILING_WHITESPACE)
ENDMACRO()

if (GIT_EXECUTABLE AND NOT LCB_SKIP_GIT_VERSION)
    RUNGIT(LCB_REVDESCRIBE describe --long --abbrev=10)
    RUNGIT(LCB_VERSION describe --abbrev=10)
    STRING(REPLACE "-" "_" LCB_VERSION "${LCB_VERSION}")
    MESSAGE(STATUS "Sanitized VERSION=${LCB_VERSION}")
    RUNGIT(LCB_VERSION_CHANGESET rev-parse HEAD)

    EXECUTE_PROCESS(
        COMMAND echo ${LCB_VERSION}
        COMMAND awk -F. "{printf \"0x%0.2d%0.2d%0.2d\", $1, $2, $3}"
        WORKING_DIRECTORY ${PROJECT_SOURCE_DIR}
        OUTPUT_VARIABLE LCB_VERSION_HEX)
ENDIF()

IF(LCB_VERSION)
    # Have the version information
    CONFIGURE_FILE(${LCB_GENINFODIR}/distinfo.cmake.in ${LCB_GENINFODIR}/distinfo.cmake)
ENDIF()

# library version
IF(NOT LCB_VERSION AND EXISTS ${LCB_GENINFODIR}/distinfo.cmake)
    INCLUDE(${LCB_GENINFODIR}/distinfo.cmake)
ENDIF()

IF (NOT LCB_VERSION)
    SET(LCB_NOGITVERSION ON)
    SET(LCB_VERSION ${libcouchbase_VERSION})
ENDIF()
IF (NOT LCB_VERSION_CHANGESET)
    SET(LCB_VERSION_CHANGESET "0xdeadbeef")
ENDIF()
IF (NOT LCB_VERSION_HEX)
    MATH(EXPR LCB_VERSION_HEX
         "${libcouchbase_VERSION_MAJOR} * 0x10000 + ${libcouchbase_VERSION_MINOR} * 0x100 + ${libcouchbase_VERSION_PATCH}"
         OUTPUT_FORMAT HEXADECIMAL)
ENDIF()

# Now parse the version string
STRING(REPLACE "." ";" LCB_VERSION_LIST "${LCB_VERSION}")
LIST(GET LCB_VERSION_LIST 0 LCB_VERSION_MAJOR)
LIST(GET LCB_VERSION_LIST 1 LCB_VERSION_MINOR)
LIST(GET LCB_VERSION_LIST 2 LCB_VERSION_PATCH)

# Determine the SONAME for the library
IF(APPLE)
    SET(LCB_SONAME_MAJOR "9")
ELSE()
    SET(LCB_SONAME_MAJOR "8")
ENDIF()
SET(LCB_SONAME_FULL "${LCB_SONAME_MAJOR}.0.10")

MESSAGE(STATUS "libcouchbase ${LCB_VERSION_MAJOR},${LCB_VERSION_MINOR},${LCB_VERSION_PATCH}")
MESSAGE(STATUS "Building libcouchbase ${LCB_VERSION}/${LCB_VERSION_CHANGESET}")
